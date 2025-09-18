const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const categoryValidator = require("./validation/categoriesValidator.js");
const categoryDeleteValidator = require("./validation/categoryDeleteValidator.js");
const redirectToValidator = require("./validation/redirectToValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This category does not exist!",
  getEditById: "Cannot edit — this category does not exist!",
  getDeleteById: "Cannot delete — this category does not exist!",
  postDeleteById: "Cannot delete — this category does not exist!",
  postEditById: "Cannot edit — this category does not exist!",
};

exports.get = asyncHandler(async (req, res) => {
  const categoriesBriefData = await db.read.categoriesBrief();

  res.render("categories", {
    pageTitle: process.env.TITLE,
    categoriesBriefData,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const categoryData = await db.read.category(id);

  if (categoryData == null) {
    throw new CustomNotFoundError(err404Msg.getById);
  }

  res.render("category", {
    pageTitle: process.env.TITLE,
    categoryData,
    formatCost,
  });
});

exports.getNew = asyncHandler(async (req, res) => {
  const ingredients = await db.read.ingredientsNames();
  const pizzas = await db.read.pizzasNames();

  res.render("categoryMutation", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
  });
});

exports.postNew = [
  categoryValidator,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.category(body);

    // this always redirect to the new category
    res.redirect("/categories/" + id);
  }),
];

exports.getEditById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const categoryData = await db.read.categoryEdit(id);
  const ingredients = await db.read.ingredientsNames();
  const pizzas = await db.read.pizzasNames();

  if (categoryData == null) {
    throw new CustomNotFoundError(err404Msg.getEditById);
  }

  res.render("categoryMutation", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
    data: categoryData,
    edit: true,
  });
});

exports.postEditById = [
  categoryValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const { id, updated } = await db.update.category(data);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postEditById);
    }

    res.redirect(data.redirectTo || "/categories/" + id);
  }),
];

exports.getDeleteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const categoryData = await db.read.categoryDelete(id);

  if (categoryData == null) {
    throw new CustomNotFoundError(err404Msg.getDeleteById);
  }

  res.render("categoryDelete", {
    pageTitle: process.env.TITLE,
    data: categoryData,
  });
});

exports.postDeleteById = [
  categoryDeleteValidator,
  (req, res, next) => {
    /* Exclude the route to the deleted item */
    const validator = redirectToValidator(`^/categories/${req.params.id}$`);
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.delete.category(data.id);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postDeleteById);
    }

    res.redirect(data.redirectTo || "/categories");
  }),
];
