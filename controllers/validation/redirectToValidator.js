const { body } = require("express-validator");

// valid urls: /, /pizzas, /ingredients, /categories, /pizzas/:id, /ingredients/:id, /categories/:id
const regexValidUrlsStr = "^(/|/(pizzas|ingredients|categories)(/\\d+)?)$";
const regexValidUrls = new RegExp(regexValidUrlsStr);

// validator returns a middleware. T
// To use it with a custom argument possibly depending on req / res,
// call it as follows in the middleware chain:
// (req, res, next) => {
//    const validator = redirectToValidator(/* url depending on req / res or empty */);
//    return validator(req, res, next);
//  }

const validator = (excludedPattern = "^$") =>
  body("redirectTo")
    .trim()
    .optional({ values: "falsy" })
    .customSanitizer((url) => (url !== "/" ? url.replace(/\/$/, "") : url))
    .matches(regexValidUrls)
    .not()
    .matches(new RegExp(excludedPattern));

/* Do nothing on validation errors: make sure a fallback redirect url is used instead */

module.exports = validator;
