const { query } = require("express-validator");
const handleValidationErrorsFcn = require("./helpers/handleValidationErrorsFcn.js");
const populateRouteType = require("./helpers/populateRouteType.js");

const searchValidator = [
  populateRouteType,
  query("q")
    .trim()
    .optional({ values: null }) // only  undefined and null values are optional
    // .isLength({
    //   min: 1,
    // })
    // .withMessage(`Search query cannot be empty.`)
    .isLength({
      max: process.env.NAME_MAX_LENGTH,
    })
    .withMessage(
      `The query can have at most ${process.env.NAME_MAX_LENGTH}  ${
        process.env.NAME_MAX_LENGTH == 1 ? "character" : "characters"
      }.`
    )
    .matches(new RegExp(process.env.NAME_REGEX, process.env.NAME_REGEX_FLAG))
    .withMessage(
      "The query has some invalid characters. " + process.env.NAME_REGEX_MSG
    ),
  query("fullWord")
    .customSanitizer((value) => value === "on")
    .toBoolean(),
  query("matchAllWords")
    .customSanitizer((value) => value === "on")
    .toBoolean(),
  query("caseSensitive")
    .customSanitizer((value) => value === "on")
    .toBoolean(),
  query("exactMatch")
    .customSanitizer((value) => value === "on")
    .toBoolean(),
  handleValidationErrorsFcn("search"),
];

module.exports = searchValidator;
