const { body } = require("express-validator");

const protectedValidation = [
  body("password").custom((password, { req }) => {
    if (req.path === "/new") {
      if (req.body.is_protected) {
        if (!req.body.password) {
          throw new Error(
            `The admin password is required for enabling protection on this item.`
          );
        }

        // Verify password
        if (
          typeof req.body.password !== "string" ||
          req.body.password.length > parseInt(process.env.PWD_MAX_LENGTH) ||
          req.body.password !== process.env.ADMIN_PASSWORD
        ) {
          throw new Error(
            "The admin password to enable protection on this item is incorrect."
          );
        }
      }
    }

    return true;
  }),
  body("is_protected")
    .customSanitizer((value) => value === "on")
    .toBoolean(),
];

module.exports = protectedValidation;
