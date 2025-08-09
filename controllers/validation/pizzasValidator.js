const { body } = require("express-validator");
const protectedValidation = require("./protectedValidation.js");
const populateReqLocalsWithValidNames = require("./populateReqLocalsWithValidNames.js");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const newValidation = [
  protectedValidation,
  populateReqLocalsWithValidNames,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("The name cannot be empty.")
    .custom((value, { req }) => {
      if (req.locals.allPizzas.includes(value)) {
        throw new Error(`A pizza named '${value}' already exists.`);
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
  body("ingredients")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for ingredients.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates
  body("ingredients.*").custom(async (value, { req }) => {
    if (!req.locals.allIngredients.includes(value)) {
      throw new Error(`Ingredient '${value}' is not allowed.`);
    }
    return true;
  }),
  body("categories")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for categories.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("categories.*").custom(async (value, { req }) => {
    if (!req.locals.allCategories.includes(value)) {
      throw new Error(`Category '${value}' is not allowed.`);
    }
    return true;
  }),
  handleValidationErrorsFcn("pizzaNew"),
];

module.exports = newValidation;
