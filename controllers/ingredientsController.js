const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = asyncHandler(async (req, res) => {
  const ingredientsBriefData = await db.read.ingredientsBrief();

  res.render("ingredients", { title: process.env.TITLE, ingredientsBriefData });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingredientData = await db.read.ingredient(id);

  res.send("ingredient " + id + JSON.stringify(ingredientData));
});
