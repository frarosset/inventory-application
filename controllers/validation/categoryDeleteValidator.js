const protectedValidator = require("./helpers/protectedValidator.js");
const populateRouteType = require("./helpers/populateRouteType.js");
const populateReqLocalsWithItemData = require("./helpers/populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");

const categoryValidator = [
  populateReqLocalsWithItemData,
  populateRouteType,
  protectedValidator,
  handleValidationErrorsFcn("categoryDelete"),
];

module.exports = categoryValidator;
