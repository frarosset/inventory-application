const protectedValidator = require("./protectedValidator.js");
const populateRouteType = require("./populateRouteType.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const categoryValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidator,
  handleValidationErrorsFcn("categoryDelete"),
];

module.exports = categoryValidator;
