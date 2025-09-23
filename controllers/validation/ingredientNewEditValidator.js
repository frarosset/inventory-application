const { body } = require("express-validator");
const protectedValidator = require("./helpers/protectedValidator.js");
const populateReqLocalsWithValidNames = require("./helpers/populateReqLocalsWithValidNames.js");
const populateRouteType = require("./helpers/populateRouteType.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");

const priceDecimalDigits = process.env.PRICE_DECIMAL_DIGITS;
const priceMax = parseFloat(process.env.PRICE_MAX);
const stockMax = parseInt(process.env.STOCK_MAX);

const ingredientValidator = [
  populateRouteType,
  populateReqLocalsWithValidNames,
  protectedValidator,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("The name cannot be empty.")
    .custom((value, { req }) => {
      if (
        req.locals.allIngredients.includes(value) &&
        value !== req.locals.allIngredientsIdNameMap.get(req.params.id)
      ) {
        throw new Error(`An ingredient named '${value}' already exists.`);
      }
      return true;
    })
    .isLength({
      max: process.env.NAME_MAX_LENGTH,
    })
    .withMessage(
      `The name can have at most ${process.env.NAME_MAX_LENGTH}  ${
        process.env.NAME_MAX_LENGTH == 1 ? "character" : "characters"
      }.`
    )
    .matches(new RegExp(process.env.NAME_REGEX, process.env.NAME_REGEX_FLAG))
    .withMessage(
      "The name has some invalid characters. " + process.env.NAME_REGEX_MSG
    ),
  body("notes")
    .trim()
    .optional({ values: "falsy" })
    .isLength({
      max: process.env.NOTES_MAX_LENGTH,
    })
    .withMessage(
      `Notes can have at most ${process.env.NOTES_MAX_LENGTH}  ${
        process.env.NOTES_MAX_LENGTH == 1 ? "character" : "characters"
      }.`
    )
    .matches(new RegExp(process.env.NOTES_REGEX, process.env.NOTES_REGEX_FLAG))
    .withMessage(
      "Notes have some invalid characters. " + process.env.NOTES_REGEX_MSG
    ),
  body("price")
    .trim()
    .notEmpty()
    .withMessage("The ingredient price cannot be empty.")
    .isDecimal({
      force_decimal: false,
      decimal_digits: `0,${priceDecimalDigits}`,
    })
    .withMessage(
      `The ingredient price must be a non-negative decimal number with at most ${priceDecimalDigits} decimal digits.`
    )
    .toFloat()
    .custom((price) => {
      if (price < 0) {
        throw new Error(`The ingredient price cannot be negative.`);
      }
      return true;
    })
    .custom((price) => {
      if (price > priceMax) {
        throw new Error(
          `The ingredient price cannot be greater than ${priceMax} ${process.env.CURRENCY}.`
        );
      }
      return true;
    }),
  body("stock")
    .trim()
    .notEmpty()
    .withMessage("The ingredient stock cannot be empty.")
    .isInt({ min: 0 })
    .withMessage("The ingredient stock must be a non-negative integer number.")
    .isInt({
      max: stockMax,
    })
    .withMessage(`The ingredient stock cannot be greater than ${stockMax}.`)
    .toInt(),
  body("incompatibleCategories")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for incompatible categories.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("incompatibleCategories.*").custom(async (value, { req }) => {
    if (!req.locals.allCategories.includes(value)) {
      throw new Error(`Category '${value}' is not allowed.`);
    }
    return true;
  }),
  body("enforcedCategories")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for enforced categories.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("enforcedCategories.*")
    .custom(async (value, { req }) => {
      if (!req.locals.allCategories.includes(value)) {
        throw new Error(`Category '${value}' is not allowed.`);
      }
      return true;
    })
    .custom(async (value, { req }) => {
      if (
        req.body.incompatibleCategories &&
        req.body.incompatibleCategories.includes(value)
      ) {
        throw new Error(
          `Category '${value}' cannot be both enforced and incompatible.`
        );
      }
      return true;
    }),
  body("pizzas")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for pizzas using this ingredient.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("pizzas.*").custom(async (value, { req }) => {
    if (!req.locals.allPizzas.includes(value)) {
      throw new Error(`Pizza '${value}' is not allowed.`);
    }
    return true;
  }),
  body("passwordCheckboxList").custom((value, { req }) => {
    const anyProtectedPizzas = req.body.pizzas?.some((pizza) =>
      req.locals.allProtectedPizzas.includes(pizza)
    );

    if (anyProtectedPizzas) {
      if (!req.body.passwordCheckboxList) {
        throw new Error(
          "The admin password is required to use this ingredient in the selected protected pizzas."
        );
      }

      if (
        typeof req.body.passwordCheckboxList !== "string" ||
        req.body.passwordCheckboxList.length >
          parseInt(process.env.PWD_MAX_LENGTH) ||
        req.body.passwordCheckboxList !== process.env.ADMIN_PASSWORD
      ) {
        throw new Error(
          "The admin password to use this ingredient in  the selected protected pizzas is incorrect."
        );
      }
    }
    return true;
  }),
  handleValidationErrorsFcn("ingredientNewEdit"),
];

module.exports = ingredientValidator;
