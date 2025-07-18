const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = asyncHandler(async (req, res) => {
  const categoriesBriefData = await db.read.categoriesBrief();

  res.render("categories", { title: process.env.TITLE, categoriesBriefData });
});
