const { body } = require("express-validator");
const protectedValidator = require("./helpers/protectedValidator.js");
const populateRouteType = require("./helpers/populateRouteType.js");
const populateReqLocalsWithItemData = require("./helpers/populateReqLocalsWithItemData.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");

const ingredientValidator = [
  populateRouteType,
  populateReqLocalsWithItemData,
  protectedValidator,
  body("passwordList").custom((passwordList, { req }) => {
    const anyProtectedPizzas = req.locals.itemData.protected_pizzas.length > 0;

    if (anyProtectedPizzas) {
      if (!passwordList) {
        throw new Error(
          "The admin password is required to delete this ingredient from the selected protected pizzas."
        );
      }

      if (
        typeof passwordList !== "string" ||
        passwordList.length > parseInt(process.env.PWD_MAX_LENGTH) ||
        passwordList !== process.env.ADMIN_PASSWORD
      ) {
        throw new Error(
          "The admin password to delete this ingredient from the selected protected pizzas is incorrect."
        );
      }
    }
    return true;
  }),
  handleValidationErrorsFcn("ingredientDelete"),
];

module.exports = ingredientValidator;
