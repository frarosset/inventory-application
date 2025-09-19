const { param } = require("express-validator");
const CustomNotFoundError = require("../../errors/CustomNotFoundError");
const { validationResult } = require("express-validator");

const idValidator = (invalidIdMessage) => [
  param("id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Resource ID must be a positive integer.")
    .toInt(),
  (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      const msg = result.errors[0].msg;

      throw new CustomNotFoundError(invalidIdMessage + " " + msg);
    }
    // no errors
    next();
  },
];

module.exports = idValidator;
