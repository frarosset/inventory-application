const db = require("../../db/queries.js");

// get all existing pizzas, ingredients, categories names
const populateReqLocalsWithItemData = async (req, res, next) => {
  req.locals = req.locals || {};

  const baseUrl = req.baseUrl;

  const dbRead = baseUrl === "/pizzas" ? db.read.pizzaDelete : null;

  const itemData = await dbRead(req.params.id);

  req.locals.itemData = itemData;

  next();
};

module.exports = populateReqLocalsWithItemData;
