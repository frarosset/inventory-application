const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const pizzasValidator = require("./validation/pizzasValidator.js");
const pizzasDeleteValidator = require("./validation/pizzasDeleteValidator.js");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

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

    res.redirect("/pizzas/" + id);
  }),
];

exports.getEditById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pizzaData = await db.read.pizzaEdit(id);
  const ingredients = await db.read.ingredientsNames();
  const categories = await db.read.categoriesNames();

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
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.update.pizza(data);

    // id is undefined if no change are made. Use data.id instead
    // Possibly, use id to possibly show a message of no edit done

    res.redirect("/pizzas/" + data.id);
  }),
];

exports.getDeleteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pizzaData = await db.read.pizzaDelete(id);

  res.render("pizzaDelete", {
    pageTitle: process.env.TITLE,
    data: pizzaData,
  });
});

exports.postDeleteById = [
  pizzasDeleteValidator,
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.delete.pizza(data.id);

    res.redirect("/pizzas/");
  }),
];
