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
    .toInt()
    .custom((unitsToRestock, { req }) => {
      const maxUnitsToRestock = Math.max(
        0,
        parseInt(process.env.STOCK_MAX) - req.locals.itemData.stock
      );

      if (maxUnitsToRestock === 0) {
        throw new Error(
          `You’ve reached the maximum stock limit, so no further items can be added.`
        );
      }

      if (unitsToRestock > maxUnitsToRestock) {
        throw new Error(
          `The maximum amount you can add is ${maxUnitsToRestock} units, to avoid exceeding the maximum stock limit.`
        );
      }

      return true;
    }),
  handleValidationErrorsFcn("doughRestock"),
];

module.exports = doughValidator;
