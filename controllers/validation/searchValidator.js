const { query } = require("express-validator");
const handleValidationErrorsFcn = require("./handleValidationErrorsFcn.js");

const searchValidator = [
  (req, res, next) => {
    req.locals = req.locals || {};
    req.locals.isSearch = true;
    next();
  },
  query("q")
    .trim()
    .optional({ values: "falsy" })
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
  handleValidationErrorsFcn("search"),
];

module.exports = searchValidator;
