const { body } = require("express-validator");
const protectedValidation = require("./protectedValidation.js");
const populateReqLocalsWithValidNames = require("./populateReqLocalsWithValidNames.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const newValidation = [
  protectedValidation(),
  populateReqLocalsWithValidNames,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("The name cannot be empty.")
    .custom((value, { req }) => {
      if (req.locals.allIngredients.includes(value)) {
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
      "The name has some invalid characters." + process.env.NAME_REGEX_MSG
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
      "Notes have some invalid characters." + process.env.NOTES_REGEX_MSG
    ),
  body("price")
    .trim()
    .notEmpty()
    .withMessage("The ingredient price cannot be empty.")
    .isDecimal({
      min: 0,
      force_decimal: false,
      decimal_digits: `0,${process.env.INGREDIENT_PRICE_DECIMAL_DIGITS}`,
    })
    .withMessage(
      `The ingredient price must be a non-negative decimal number with at most ${process.env.INGREDIENT_PRICE_DECIMAL_DIGITS} decimal digits.`
    )
    .toFloat(),
  body("stock")
    .trim()
    .notEmpty()
    .withMessage("The ingredient stock cannot be empty.")
    .isInt({ min: 0 })
    .withMessage("The ingredient stock must be a non-negative integer number.")
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
  handleValidationErrorsFcn("ingredientMutation"),
];

module.exports = newValidation;
