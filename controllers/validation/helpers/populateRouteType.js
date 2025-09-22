const populateRouteType = [
  (req, res, next) => {
    req.locals = req.locals || {};

    const path = req.path;
    const id = req.params.id;

    req.locals.isNew = path === "/new";
    req.locals.isEdit = path === `/${id}/edit`;
    req.locals.isDelete = path === `/${id}/delete`;
    req.locals.isRestock = path === `/${id}/restock`;
    req.locals.isOrder = path === `/${id}/order`;
    req.locals.isSearch = path === `/search`;

    const baseUrl = req.baseUrl;

    req.locals.isPizzas = baseUrl === "/pizzas";
    req.locals.isIngredients = baseUrl === "/ingredients";
    req.locals.isCategories = baseUrl === "/categories";
    req.locals.isDoughs = baseUrl === "/doughs";

    next();
  },
];

module.exports = populateRouteType;
