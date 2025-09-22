const protectedValidator = require("./protectedValidator.js");
const populateRouteType = require("./populateRouteType.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const pizzaValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidator,
  handleValidationErrorsFcn("pizzaDelete"),
];

module.exports = pizzaValidator;
