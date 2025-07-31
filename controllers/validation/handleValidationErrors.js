const { validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).send(result.errors);
    // todo: show the form with submitted data already filled
  }
  // no errors
  next();
};

module.exports = handleValidationErrors;
