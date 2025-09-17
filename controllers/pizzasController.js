const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const pizzasValidator = require("./validation/pizzasValidator.js");
const pizzasDeleteValidator = require("./validation/pizzasDeleteValidator.js");
const redirectToValidator = require("./validation/redirectToValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This pizza does not exist!",
  getEditById: "Cannot edit — this pizza does not exist!",
  getDeleteById: "Cannot delete — this pizza does not exist!",
};

exports.get = asyncHandler(async (req, res) => {
  const pizzasBriefData = await db.read.pizzasBrief();

  res.render("pizzas", {
    pageTitle: process.env.TITLE,
    pizzasBriefData,
    formatCost,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pizzaData = await db.read.pizza(id);

  if (pizzaData == null) {
    throw new CustomNotFoundError(err404Msg.getById);
  }

  res.render("pizza", { pageTitle: process.env.TITLE, pizzaData, formatCost });
});

exports.getNew = asyncHandler(async (req, res) => {
  const ingredients = await db.read.ingredientsNames();
  const categories = await db.read.categoriesNames();

  res.render("pizzaMutation", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    categories: categories.map((i) => i.name),
  });
});

exports.postNew = [
  pizzasValidator,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.pizza(body);

    // this always redirect to the new pizza
    res.redirect("/pizzas/" + id);
  }),
];

exports.getEditById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pizzaData = await db.read.pizzaEdit(id);
  const ingredients = await db.read.ingredientsNames();
  const categories = await db.read.categoriesNames();

  if (pizzaData == null) {
    throw new CustomNotFoundError(err404Msg.getEditById);
  }

  res.render("pizzaMutation", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    categories: categories.map((i) => i.name),
    data: pizzaData,
    edit: true,
  });
});

exports.postEditById = [
  pizzasValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.update.pizza(data);

    // id is undefined if no change are made. Use data.id instead
    // Possibly, use id to possibly show a message of no edit done

    res.redirect(data.redirectTo || "/pizzas/" + data.id);
  }),
];

exports.getDeleteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pizzaData = await db.read.pizzaDelete(id);

  if (pizzaData == null) {
    throw new CustomNotFoundError(err404Msg.getDeleteById);
  }

  res.render("pizzaDelete", {
    pageTitle: process.env.TITLE,
    data: pizzaData,
  });
});

exports.postDeleteById = [
  pizzasDeleteValidator,
  (req, res, next) => {
    /* Exclude the route to the deleted item */
    const validator = redirectToValidator(`^/pizzas/${req.params.id}$`);
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.delete.pizza(data.id);

    res.redirect(data.redirectTo || "/pizzas");
  }),
];
