const { body } = require("express-validator");
const protectedValidator = require("./helpers/protectedValidator.js");
const populateReqLocalsWithValidDoughNames = require("./helpers/populateReqLocalsWithValidDoughNames.js");
const populateRouteType = require("./helpers/populateRouteType.js");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");

const priceDecimalDigits = process.env.PRICE_DECIMAL_DIGITS;
const priceMax = parseFloat(process.env.PRICE_MAX);
const stockMax = parseInt(process.env.STOCK_MAX);

const doughValidator = [
  populateRouteType,
  populateReqLocalsWithValidDoughNames,
  protectedValidator,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("The name cannot be empty.")
    .custom((value, { req }) => {
      if (
        req.locals.allDoughs.includes(value) &&
        value !== req.locals.allDoughsIdNameMap.get(req.params.id)
      ) {
        throw new Error(`An dough named '${value}' already exists.`);
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
    .withMessage("The dough price cannot be empty.")
    .isDecimal({
      force_decimal: false,
      decimal_digits: `0,${priceDecimalDigits}`,
    })
    .withMessage(
      `The dough price must be a non-negative decimal number with at most ${priceDecimalDigits} decimal digits.`
    )
    .toFloat()
    .custom((price) => {
      if (price < 0) {
        throw new Error(`The dough price cannot be negative.`);
      }
      return true;
    })
    .custom((price) => {
      if (price > priceMax) {
        throw new Error(
          `The dough price cannot be greater than ${priceMax} ${process.env.CURRENCY}.`
        );
      }
      return true;
    }),
  body("stock")
    .trim()
    .notEmpty()
    .withMessage("The dough stock cannot be empty.")
    .isInt({ min: 0 })
    .withMessage("The dough stock must be a non-negative integer number.")
    .isInt({
      max: stockMax,
    })
    .withMessage(`The dough stock cannot be greater than ${stockMax}.`)
    .toInt(),
  handleValidationErrorsFcn("doughNewEdit"),
];

module.exports = doughValidator;
