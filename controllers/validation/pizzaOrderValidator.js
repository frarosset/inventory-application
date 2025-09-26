const { body } = require("express-validator");
const populateRouteType = require("./helpers/populateRouteType.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");
const populateReqLocalsWithItemData = require("./helpers/populateReqLocalsWithItemData.js");
const idValidator = require("./helpers/idValidator.js");

const pizzaValidator = [
  populateRouteType,
  idValidator("The selected dough does not exist.", "doughId", "body"),
  populateReqLocalsWithItemData,
  // Allow ordering a different dough
  // body("doughId").custom((doughId, { req }) => {
  //   if (Number(process.env.BASE_DOUGH_ID) !== doughId) {
  //     throw new Error(`The selected dough is invalid.`);
  //   }

  //   return true;
  // }),
  body("unitsToOrder")
    .trim()
    .notEmpty()
    .withMessage("The amount of servings to order cannot be empty.")
    .isInt({ min: 1 })
    .withMessage(
      `The amount of servings to order must be a positive integer number.`
    )
    .toInt()
    .custom((unitsToOrder, { req }) => {
      const maxAvailability = req.locals.itemData.doughVariantsPerPizza.find(
        (d) => d.id === req.body.doughId
      ).pizza_availability;

      if (maxAvailability === 0) {
        throw new Error(
          `There are currently no available pizzas made with this dough — this may be due to missing ingredients. Try selecting a different dough.`
        );
      }

      if (unitsToOrder > maxAvailability) {
        throw new Error(
          `There are only ${maxAvailability} servings available with the selected dough.`
        );
      }

      return true;
    }),
  handleValidationErrorsFcn("pizzaOrder"),
];

module.exports = pizzaValidator;
