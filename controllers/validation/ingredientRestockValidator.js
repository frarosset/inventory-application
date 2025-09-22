const { body } = require("express-validator");
const populateRouteType = require("./populateRouteType.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");
const populateReqLocalsWithItemData = require("./populateReqLocalsWithItemData.js");

const ingredientRestockValidator = [
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
  handleValidationErrorsFcn("ingredientRestock"),
];

module.exports = ingredientRestockValidator;
