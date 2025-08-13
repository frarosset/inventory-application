const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const newValidation = require("./validation/ingredientsValidator.js");
const { matchedData } = require("express-validator");

exports.get = asyncHandler(async (req, res) => {
  const ingredientsBriefData = await db.read.ingredientsBrief();

  res.render("ingredients", {
    pageTitle: process.env.TITLE,
    ingredientsBriefData,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingredientData = await db.read.ingredient(id);

  res.render("ingredient", { pageTitle: process.env.TITLE, ingredientData });
});

exports.getNew = (req, res) => {
  res.send("New ingredient form");
};
exports.getNew = asyncHandler(async (req, res) => {
  const categories = await db.read.categoriesNames();
  const pizzas = await db.read.pizzasNames();

  res.render("ingredientNew", {
    pageTitle: process.env.TITLE,
    categories: categories.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
  });
});

exports.postNew = [
  newValidation,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.ingredient(body);

    res.redirect("/ingredients/" + id);
  }),
];

exports.getEditById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingredientData = await db.read.ingredientEdit(id);
  const categories = await db.read.categoriesNames();
  const pizzas = await db.read.pizzasNames();

  res.render("ingredientNew", {
    pageTitle: process.env.TITLE,
    categories: categories.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
    data: ingredientData,
    edit: true,
  });
});
