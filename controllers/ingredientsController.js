const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const ingredientsValidator = require("./validation/ingredientsValidator.js");
const ingredientDeleteValidator = require("./validation/ingredientDeleteValidator.js");
const redirectToValidator = require("./validation/redirectToValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This ingredient does not exist!",
  getEditById: "Cannot edit — this ingredient does not exist!",
  getDeleteById: "Cannot delete — this ingredient does not exist!",
};

exports.get = asyncHandler(async (req, res) => {
  const ingredientsBriefData = await db.read.ingredientsBrief();

  res.render("ingredients", {
    pageTitle: process.env.TITLE,
    ingredientsBriefData,
    formatCost,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingredientData = await db.read.ingredient(id);

  if (ingredientData == null) {
    throw new CustomNotFoundError(err404Msg.getById);
  }

  res.render("ingredient", {
    pageTitle: process.env.TITLE,
    ingredientData,
    formatCost,
  });
});

exports.getNew = asyncHandler(async (req, res) => {
  const categories = await db.read.categoriesNames();
  const pizzas = await db.read.pizzasNames();

  res.render("ingredientMutation", {
    pageTitle: process.env.TITLE,
    categories: categories.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
  });
});

exports.postNew = [
  ingredientsValidator,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.ingredient(body);

    // this always redirect to the new ingredient
    res.redirect("/ingredients/" + id);
  }),
];

exports.getEditById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingredientData = await db.read.ingredientEdit(id);
  const categories = await db.read.categoriesNames();
  const pizzas = await db.read.pizzasNames();

  if (ingredientData == null) {
    throw new CustomNotFoundError(err404Msg.getEditById);
  }

  res.render("ingredientMutation", {
    pageTitle: process.env.TITLE,
    categories: categories.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
    data: ingredientData,
    edit: true,
  });
});

exports.postEditById = [
  ingredientsValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.update.ingredient(data);

    // id is undefined if no change are made. Use data.id instead
    // Possibly, use id to possibly show a message of no edit done

    res.redirect(data.redirectTo || "/ingredients/" + data.id);
  }),
];

exports.getDeleteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingredientData = await db.read.ingredientDelete(id);

  if (ingredientData == null) {
    throw new CustomNotFoundError(err404Msg.getDeleteById);
  }

  res.render("ingredientDelete", {
    pageTitle: process.env.TITLE,
    data: ingredientData,
  });
});

exports.postDeleteById = [
  ingredientDeleteValidator,
  (req, res, next) => {
    /* Exclude the route to the deleted item */
    const validator = redirectToValidator(`^/ingredients/${req.params.id}$`);
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.delete.ingredient(data.id);

    res.redirect(data.redirectTo || "/ingredients");
  }),
];
