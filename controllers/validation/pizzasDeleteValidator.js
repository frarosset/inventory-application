const protectedValidation = require("./protectedValidation.js");
const populateRouteType = require("./populateRouteType.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const pizzasValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidation,
  handleValidationErrorsFcn("pizzaDelete"),
];

module.exports = pizzasValidator;
