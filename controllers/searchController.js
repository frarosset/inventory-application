const searchValidator = require("./validation/searchValidator.js");
const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const formatCost = require("./scripts/formatCost.js");

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

      res.render("searchResults", {
        pageTitle: process.env.TITLE,
        q,
        pizzasBriefData,
        categoriesBriefData,
        ingredientsBriefData,
        formatCost,
      });
    }
  }),
];
