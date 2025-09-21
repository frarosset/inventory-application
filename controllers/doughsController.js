const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const formatCost = require("./scripts/formatCost.js");

exports.get = asyncHandler(async (req, res) => {
  const doughsBriefData = await db.read.doughsBrief();

  res.render("doughs", {
    pageTitle: process.env.TITLE,
    doughsBriefData,
    formatCost,
  });
});
