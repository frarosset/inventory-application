const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = asyncHandler(async (req, res) => {
  const ingredientsBriefData = await db.read.ingredientsBrief();

  res.render("ingredients", { title: process.env.TITLE, ingredientsBriefData });
});

exports.getById = (req, res) => {
  const { id } = req.params;
  res.send("ingredient" + id);
};
