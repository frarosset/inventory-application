const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const ingredientNewEditValidator = require("./validation/ingredientNewEditValidator.js");
const ingredientDeleteValidator = require("./validation/ingredientDeleteValidator.js");
const ingredientRestockValidator = require("./validation/ingredientRestockValidator.js");
const redirectToValidator = require("./validation/helpers/redirectToValidator.js");
const idValidator = require("./validation/helpers/idValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This ingredient does not exist!",
  getEditById: "Cannot edit — this ingredient does not exist!",
  getDeleteById: "Cannot delete — this ingredient does not exist!",
  postDeleteById: "Cannot delete — this ingredient does not exist!",
  postEditById: "Cannot edit — this ingredient does not exist!",
  getRestockById: "Cannot restock — this ingredient does not exist!",
  postRestockById: "Cannot restock — this ingredient does not exist!",
};

exports.get = asyncHandler(async (req, res) => {
  const ingredientsBriefData = await db.read.ingredientsBrief();

  res.render("ingredients", {
    pageTitle: process.env.TITLE,
    ingredientsBriefData,
    formatCost,
  });
});

exports.getById = [
  idValidator(err404Msg.getById),
  asyncHandler(async (req, res) => {
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
  }),
];

exports.getNew = asyncHandler(async (req, res) => {
  const categories = await db.read.categoriesNames();
  const pizzas = await db.read.pizzasNames();

  res.render("ingredientNewEdit", {
    pageTitle: process.env.TITLE,
    categories: categories.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
  });
});

exports.postNew = [
  ingredientNewEditValidator,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.ingredient(body);

    // this always redirect to the new ingredient
    res.redirect("/ingredients/" + id);
  }),
];

exports.getEditById = [
  idValidator(err404Msg.getEditById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ingredientData = await db.read.ingredientEdit(id);
    const categories = await db.read.categoriesNames();
    const pizzas = await db.read.pizzasNames();

    if (ingredientData == null) {
      throw new CustomNotFoundError(err404Msg.getEditById);
    }

    res.render("ingredientNewEdit", {
      pageTitle: process.env.TITLE,
      categories: categories.map((i) => i.name),
      pizzas: pizzas.map((i) => i.name),
      protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
      data: ingredientData,
      edit: true,
    });
  }),
];

exports.postEditById = [
  idValidator(err404Msg.postEditById),
  ingredientNewEditValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const { id, updated } = await db.update.ingredient(data);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postEditById);
    }

    res.redirect(data.redirectTo || "/ingredients/" + id);
  }),
];

exports.getDeleteById = [
  idValidator(err404Msg.getDeleteById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ingredientData = await db.read.ingredientDelete(id);

    if (ingredientData == null) {
      throw new CustomNotFoundError(err404Msg.getDeleteById);
    }

    res.render("ingredientDelete", {
      pageTitle: process.env.TITLE,
      data: ingredientData,
    });
  }),
];

exports.postDeleteById = [
  idValidator(err404Msg.postDeleteById),
  ingredientDeleteValidator,
  (req, res, next) => {
    /* Exclude the route to the deleted item */
    const validator = redirectToValidator(`^/ingredients/${req.params.id}$`);
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.delete.ingredient(data.id);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postDeleteById);
    }

    res.redirect(data.redirectTo || "/ingredients");
  }),
];

exports.getRestockById = [
  idValidator(err404Msg.getRestockById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ingredientData = await db.read.ingredientRestock(id);

    if (ingredientData == null) {
      throw new CustomNotFoundError(err404Msg.getRestockById);
    }

    res.render("ingredientRestock", {
      pageTitle: process.env.TITLE,
      data: ingredientData,
    });
  }),
];

exports.postRestockById = [
  idValidator(err404Msg.postRestockById),
  ingredientRestockValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const { id, updated } = await db.update.ingredientRestock(data);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postRestockById);
    }

    res.redirect(data.redirectTo || "/ingredients/" + id);
  }),
];
