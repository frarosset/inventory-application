const protectedValidation = require("./protectedValidation.js");
const populateRouteType = require("./populateRouteType.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const ingredientsValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidation,
  handleValidationErrorsFcn("ingredientDelete"),
];

module.exports = ingredientsValidator;
