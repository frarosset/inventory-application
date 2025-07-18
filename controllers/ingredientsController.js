const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");

exports.get = asyncHandler(async (req, res) => {
  const ingredientsBriefData = await db.read.ingredientsBrief();

  res.send("ingredients" + JSON.stringify(ingredientsBriefData));
});
