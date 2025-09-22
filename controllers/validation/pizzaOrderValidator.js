const { body } = require("express-validator");
const populateRouteType = require("./helpers/populateRouteType.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");
const populateReqLocalsWithItemData = require("./helpers/populateReqLocalsWithItemData.js");
const idValidator = require("./helpers/idValidator.js");

const pizzaValidator = [
  populateRouteType,
  idValidator("The selected dough does not exist.", "doughId", "body"),
  populateReqLocalsWithItemData,
  body("doughId").custom((doughId, { req }) => {
    if (Number(process.env.BASE_DOUGH_ID) !== doughId) {
      throw new Error(`The selected dough is invalid.`);
    }

    return true;
  }),
  body("unitsToOrder")
    .trim()
    .notEmpty()
    .withMessage("The amount to add to stock cannot be empty.")
    .isInt({ min: 1 })
    .withMessage(
      `The amount to add to stock must be a positive integer number.`
    )
    .custom((unitsToOrder, { req }) => {
      const units = parseInt(unitsToOrder);
      const max = req.locals.itemData.availability;

      if (units > max) {
        throw new Error(
          `There are only ${max} servings available with the selected dough.`
        );
      }

      return true;
    })
    .toInt(),
  handleValidationErrorsFcn("pizzaOrder"),
];

module.exports = pizzaValidator;
