const db = require("../../db/queries.js");

// get all existing pizzas, ingredients, categories names
const populateReqLocalsWithValidNames = async (req, res, next) => {
  req.locals = req.locals || {};

  const allPizzas = await db.read.pizzasNames();
  const allIngredients = await db.read.ingredientsNames();
  const allCategories = await db.read.categoriesNames();

  req.locals.allPizzas = allPizzas.map((i) => i.name);
  req.locals.allIngredients = allIngredients.map((i) => i.name);
  req.locals.allCategories = allCategories.map((i) => i.name);

  req.locals.allProtectedPizzas = allPizzas
    .filter((i) => i.is_protected)
    .map((i) => i.name);

  next();
};

module.exports = populateReqLocalsWithValidNames;
