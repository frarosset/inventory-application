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

  const allProtectedPizzas = allPizzas.filter((i) => i.is_protected);
  const allProtectedIngredients = allIngredients.filter((i) => i.is_protected);
  const allProtectedCategories = allCategories.filter((i) => i.is_protected);

  req.locals.allProtectedPizzas = allProtectedPizzas.map((i) => i.name);

  req.locals.allPizzasIdNameMap = new Map(allPizzas.map((i) => [i.id, i.name]));
  req.locals.allProtectedPizzasIdsNameMap = new Map(
    allProtectedPizzas.map((i) => [i.id, i.name])
  );

  req.locals.allIngredientsIdNameMap = new Map(
    allIngredients.map((i) => [i.id, i.name])
  );
  req.locals.allProtectedIngredientsIdsNameMap = new Map(
    allProtectedIngredients.map((i) => [i.id, i.name])
  );

  req.locals.allCategoriesIdNameMap = new Map(
    allCategories.map((i) => [i.id, i.name])
  );
  req.locals.allProtectedCategoriesIdsNameMap = new Map(
    allProtectedCategories.map((i) => [i.id, i.name])
  );

  next();
};

module.exports = populateReqLocalsWithValidNames;
