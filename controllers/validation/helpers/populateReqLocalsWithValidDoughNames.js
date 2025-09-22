const db = require("../../../db/queries.js");

// get all existing doughs names
const populateReqLocalsWithValidDoughNames = async (req, res, next) => {
  req.locals = req.locals || {};

  const allDoughs = await db.read.doughsNames();

  req.locals.allDoughs = allDoughs.map((i) => i.name);

  req.locals.allDoughsIdNameMap = new Map(allDoughs.map((i) => [i.id, i.name]));

  next();
};

module.exports = populateReqLocalsWithValidDoughNames;
