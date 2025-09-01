const protectedValidation = require("./protectedValidation.js");
const populateRouteType = require("./populateRouteType.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const categoryValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidation,
  handleValidationErrorsFcn("categoryDelete"),
];

module.exports = categoryValidator;
