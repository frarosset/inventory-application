const { body } = require("express-validator");
const protectedValidator = require("./helpers/protectedValidator.js");
const populateReqLocalsWithValidNames = require("./helpers/populateReqLocalsWithValidNames.js");
const populateRouteType = require("./helpers/populateRouteType.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");
const hasProtectedSelectedEdited = require("./helpers/hasProtectedSelectedEdited");

const categoryValidator = [
  populateRouteType,
  populateReqLocalsWithValidNames,
  protectedValidator,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("The name cannot be empty.")
    .custom((value, { req }) => {
      if (
        req.locals.allCategories.includes(value) &&
        value !== req.locals.allCategoriesIdNameMap.get(req.params.id)
      ) {
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
  body("incompatibleIngredients")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for incompatible ingredients.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("incompatibleIngredients.*").custom(async (value, { req }) => {
    if (!req.locals.allIngredients.includes(value)) {
      throw new Error(`Ingredient '${value}' is not allowed.`);
    }
    return true;
  }),
  body("enforcingIngredients")
    .optional({ nullable: true })
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray()
    .withMessage("Invalid format for enforcing ingredients.")
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("enforcingIngredients.*")
    .custom(async (value, { req }) => {
      if (!req.locals.allIngredients.includes(value)) {
        throw new Error(`Ingredient '${value}' is not allowed.`);
      }
      return true;
    })
    .custom(async (value, { req }) => {
      if (
        req.body.incompatibleIngredients &&
        req.body.incompatibleIngredients.includes(value)
      ) {
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
    .customSanitizer((value) => [...new Set(value)]), // remove duplicates,
  body("pizzas.*").custom(async (value, { req }) => {
    if (!req.locals.allPizzas.includes(value)) {
      throw new Error(`Pizza '${value}' is not allowed.`);
    }
    return true;
  }),
  body("passwordCheckboxList").custom((value, { req }) => {
    const askPassword = hasProtectedSelectedEdited(
      req.locals.isEdit,
      req.body.pizzas,
      req.locals.allProtectedPizzas,
      req.locals.prevProtectedPizzas
    );

    if (askPassword) {
      if (!req.body.passwordCheckboxList) {
        const msg = req.locals.isEdit
          ? "The admin password is required to edit the protected pizzas assigned to this category."
          : "The admin password is required to assign this category to the selected protected pizzas.";

        throw new Error(msg);
      }

      if (
        typeof req.body.passwordCheckboxList !== "string" ||
        req.body.passwordCheckboxList.length >
          parseInt(process.env.PWD_MAX_LENGTH) ||
        req.body.passwordCheckboxList !== process.env.ADMIN_PASSWORD
      ) {
        const msg = req.locals.isEdit
          ? "The admin password to edit the selected protected pizzas assigned to this category."
          : "The admin password to assign this category to the selected protected pizzas is incorrect.";

        throw new Error(msg);
      }
    }
    return true;
  }),
  handleValidationErrorsFcn("categoryNewEdit"),
];

module.exports = categoryValidator;
