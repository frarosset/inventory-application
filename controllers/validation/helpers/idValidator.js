const { param, body } = require("express-validator");
const CustomBadRequestError = require("../../../errors/CustomBadRequestError.js");
const { validationResult } = require("express-validator");

const idValidator = (invalidIdMessage, idLabel = "id", location = "param") => {
  const fcn = location === "param" ? param : body;
  return [
    fcn(idLabel)
      .trim()
      .optional()
      .isInt({ min: 1 })
      .withMessage("Resource ID must be a positive integer.")
      .toInt(),
    (req, res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        const msg = result.errors[0].msg;

        throw new CustomBadRequestError(invalidIdMessage + " " + msg);
      }
      // no errors
      next();
    },
  ];
};

module.exports = idValidator;
