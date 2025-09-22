const protectedValidator = require("./protectedValidator.js");
const populateRouteType = require("./populateRouteType.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const ingredientValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidator,
  handleValidationErrorsFcn("ingredientDelete"),
];

module.exports = ingredientValidator;
