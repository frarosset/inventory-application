const { body } = require("express-validator");
const populateRouteType = require("./helpers/populateRouteType.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");
const populateReqLocalsWithItemData = require("./helpers/populateReqLocalsWithItemData.js");

const doughValidator = [
  populateRouteType,
  populateReqLocalsWithItemData,
  body("unitsToRestock")
    .trim()
    .notEmpty()
    .withMessage("The amount to add to stock cannot be empty.")
    .isInt({ min: 1 })
    .withMessage(
      "The amount to add to stock must be a positive integer number."
    )
    .toInt(),
  handleValidationErrorsFcn("doughRestock"),
];

module.exports = doughValidator;
