const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = asyncHandler(async (req, res) => {
  const pizzasBriefData = await db.read.pizzasBrief();

  res.render("pizzas", { title: process.env.TITLE, pizzasBriefData });
});
