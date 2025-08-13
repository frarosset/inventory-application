const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const newValidation = require("./validation/categoriesValidator.js");
const { matchedData } = require("express-validator");

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

  res.render("category", { pageTitle: process.env.TITLE, categoryData });
});

exports.getNew = asyncHandler(async (req, res) => {
  const ingredients = await db.read.ingredientsNames();
  const pizzas = await db.read.pizzasNames();

  res.render("categoryNew", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
  });
});

exports.postNew = [
  newValidation,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.category(body);

    res.redirect("/categories/" + id);
  }),
];

exports.getEditById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const categoryData = await db.read.categoryEdit(id);
  const ingredients = await db.read.ingredientsNames();
  const pizzas = await db.read.pizzasNames();

  res.render("categoryNew", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
    data: categoryData,
    edit: true,
  });
});
