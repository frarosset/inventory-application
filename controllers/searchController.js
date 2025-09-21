const searchValidator = require("./validation/searchValidator.js");
const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const formatCost = require("./scripts/formatCost.js");
const { matchedData } = require("express-validator");

exports.get = [
  searchValidator,
  asyncHandler(async (req, res) => {
    const queries = matchedData(req); // req.queries

    const q = queries.q;

    if (q == null) {
      res.render("search", {
        pageTitle: process.env.TITLE,
      });
    } else {
      const pizzasBriefData = await db.read.pizzasBriefSearch(queries);
      const categoriesBriefData = await db.read.categoriesBriefSearch(queries);
      const ingredientsBriefData = await db.read.ingredientsBriefSearch(
        queries
      );
      const doughsBriefData = await db.read.doughsBriefSearch(queries);

      res.render("searchResults", {
        pageTitle: process.env.TITLE,
        q,
        pizzasBriefData,
        categoriesBriefData,
        ingredientsBriefData,
        doughsBriefData,
        formatCost,
      });
    }
  }),
];
