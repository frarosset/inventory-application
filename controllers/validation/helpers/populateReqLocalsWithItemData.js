const db = require("../../../db/queries.js");

function getReadKey(locals) {
  if (locals?.isPizzas) {
    if (locals?.isDelete) return "pizzaDelete";
    if (locals?.isOrder) return "pizzaOrder";
  } else if (locals?.isIngredients) {
    if (locals?.isDelete) return "ingredientDelete";
    if (locals?.isRestock) return "ingredientRestock";
  } else if (locals?.isCategories) {
    if (locals?.isDelete) return "categoryDelete";
  } else if (locals?.isDoughs) {
    if (locals?.isDelete) return "doughDelete";
    if (locals?.isRestock) return "doughRestock";
  }
  return null;
}

// get all existing pizzas, ingredients, categories names
const populateReqLocalsWithItemData = async (req, res, next) => {
  req.locals = req.locals || {};

  const readKey = getReadKey(req.locals);
  const dbRead = readKey ? db.read[readKey] : null;

  const itemData = await dbRead(req.params.id);

  req.locals.itemData = itemData;

  next();
};

module.exports = populateReqLocalsWithItemData;
