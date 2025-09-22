const populateRouteType = [
  (req, res, next) => {
    req.locals = req.locals || {};

    const path = req.path;
    const id = req.params.id;

    req.locals.isNew = path === "/new";
    req.locals.isEdit = path === `/${id}/edit`;
    req.locals.isDelete = path === `/${id}/delete`;
    req.locals.isRestock = path === `/${id}/restock`;
    req.locals.isSearch = path === `/search`;

    next();
  },
];

module.exports = populateRouteType;
