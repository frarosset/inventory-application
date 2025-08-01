const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const newValidation = require("./validation/categoriesValidator.js");

exports.get = asyncHandler(async (req, res) => {
  const categoriesBriefData = await db.read.categoriesBrief();

  res.render("categories", { title: process.env.TITLE, categoriesBriefData });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const categoryData = await db.read.category(id);

  res.render("category", { title: process.env.TITLE, categoryData });
});

exports.getNew = asyncHandler(async (req, res) => {
  const ingredients = await db.read.ingredientsNames();
  const pizzas = await db.read.pizzasNames();

  res.render("categoryNew", {
    title: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    pizzas: pizzas.map((i) => i.name),
    protectedPizzas: pizzas.filter((p) => p.is_protected).map((p) => p.name),
  });
});

exports.postNew = [
  newValidation,
  (req, res) => {
    const body = req.body;
    res.send(body);
  },
];
