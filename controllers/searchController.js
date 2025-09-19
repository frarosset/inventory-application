const searchValidator = require("./validation/searchValidator.js");
const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = [
  searchValidator,
  asyncHandler(async (req, res) => {
    const q = req.query.q;

    if (q == null) {
      res.render("search", {
        pageTitle: process.env.TITLE,
      });
    } else {
      const pizzasBriefData = await db.read.pizzasBriefSearch(q);
      const categoriesBriefData = await db.read.categoriesBriefSearch(q);
      const ingredientsBriefData = await db.read.ingredientsBriefSearch(q);

      res.send(
        "Search page with results for '" +
          q +
          "' | PIZZAS: " +
          JSON.stringify(pizzasBriefData) +
          " | CATEGORIES: " +
          JSON.stringify(categoriesBriefData) +
          " | INGREDIENTS: " +
          JSON.stringify(ingredientsBriefData)
      );
    }
  }),
];
