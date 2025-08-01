const { body } = require("express-validator");
const protectedValidation = require("./protectedValidation.js");
const populateReqLocalsWithValidNames = require("./populateReqLocalsWithValidNames.js");
const handleValidationErrors = require("./handleValidationErrors.js");

const newValidation = [
  protectedValidation,
  populateReqLocalsWithValidNames,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("The name cannot be empty.")
    .custom((value, { req }) => {
      if (req.locals.allCategories.includes(value)) {
        throw new Error(`A category named '${value}' already exists.`);
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
      max: process.env.NAME_MAX_LENGTH,
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
  body("incompatible")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for incompatible ingredients.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("incompatible.*").custom(async (value, { req }) => {
    if (!req.locals.allIngredients.includes(value)) {
      throw new Error(`Ingredient '${value}' is not allowed.`);
    }
    return true;
  }),
  body("enforcing")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for enforcing ingredients.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("enforcing.*")
    .custom(async (value, { req }) => {
      if (!req.locals.allIngredients.includes(value)) {
        throw new Error(`Ingredient '${value}' is not allowed.`);
      }
      return true;
    })
    .custom(async (value, { req }) => {
      if (req.body.incompatible && req.body.incompatible.includes(value)) {
        throw new Error(
          `Ingredient '${value}' cannot be both enforcing and incompatible.`
        );
      }
      return true;
    }),
  body("pizzas")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for pizzas to be assigned to this category.")
    .customSanitizer((value) => [...new Set(value)]) // remove duplicates,
    .custom((value, { req }) => {
      const anyProtectedPizzas = value.some((pizza) =>
        req.locals.allProtectedPizzas.includes(pizza)
      );

      if (anyProtectedPizzas) {
        if (!req.body.passwordCheckboxList) {
          throw new Error(
            "The admin password is required to assign this category to the selected protected pizzas."
          );
        }

        if (
          typeof req.body.passwordCheckboxList !== "string" ||
          req.body.passwordCheckboxList.length >
            parseInt(process.env.PWD_MAX_LENGTH) ||
          req.body.passwordCheckboxList !== process.env.ADMIN_PASSWORD
        ) {
          throw new Error(
            "The admin password to assign this category to the selected protected pizzas is incorrect."
          );
        }
      }

      return true;
    }),
  body("pizzas.*").custom(async (value, { req }) => {
    if (!req.locals.allPizzas.includes(value)) {
      throw new Error(`Pizza '${value}' is not allowed.`);
    }
    return true;
  }),
  handleValidationErrors,
];

module.exports = newValidation;
