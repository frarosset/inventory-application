const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const newValidation = require("./validation/pizzasValidator.js");
const { matchedData } = require("express-validator");

exports.get = asyncHandler(async (req, res) => {
  const pizzasBriefData = await db.read.pizzasBrief();

  res.render("pizzas", { title: process.env.TITLE, pizzasBriefData });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pizzaData = await db.read.pizza(id);

  res.render("pizza", { title: process.env.TITLE, pizzaData });
});

exports.getNew = asyncHandler(async (req, res) => {
  const ingredients = await db.read.ingredientsNames();
  const categories = await db.read.categoriesNames();

  res.render("pizzaNew", {
    title: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    categories: categories.map((i) => i.name),
  });
});

exports.postNew = [
  newValidation,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.pizza(body);

    res.redirect("/pizzas/" + id);
  }),
];
