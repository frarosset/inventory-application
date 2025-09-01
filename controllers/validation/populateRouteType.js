const { param } = require("express-validator");

const populateRouteType = [
  param("id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Resource ID must be a positive integer.")
    .toInt(),
  (req, res, next) => {
    req.locals = req.locals || {};

    const path = req.path;
    const id = req.params.id;

    req.locals.isNew = path === "/new";
    req.locals.isEdit = path === `/${id}/edit`;
    req.locals.isDelete = path === `/${id}/delete`;

    next();
  },
];

module.exports = populateRouteType;
