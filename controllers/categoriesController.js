const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = asyncHandler(async (req, res) => {
  const categoriesBriefData = await db.read.categoriesBrief();

  res.render("categories", { title: process.env.TITLE, categoriesBriefData });
});

exports.getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const categoryData = await db.read.category(id);

  res.send("category" + id + JSON.stringify(categoryData));
});
