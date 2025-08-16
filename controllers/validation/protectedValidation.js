const { body } = require("express-validator");

const protectedValidation = (validIdsMapName) => [
  body("password").custom(async (password, { req }) => {
    const validIdsMap = req.locals[validIdsMapName];

    if (req.locals.isNew) {
      if (req.body.is_protected) {
        checkPassword(req.body.password);
      }
    } else if (req.locals.isEdit) {
      // Check if the item is protected (from the id)
      const editProtectedItem = validIdsMap.has(req.params.id);

      if (editProtectedItem) {
        checkPassword(req.body.password, true);
      } else {
        // if request to set item as protected
        if (req.body.is_protected) {
          checkPassword(req.body.password);
        }
      }
    } else {
      throw new Error("Unknown protectedValdation route");
    }

    return true;
  }),
  body("is_protected")
    .customSanitizer((value) => value === "on")
    .toBoolean(),
];

function checkPassword(password, editProtectedItem = false) {
  if (!password) {
    throw new Error(
      `The admin password is required for ${
        editProtectedItem ? "mutating" : "enabling protection on"
      } this item.`
    );
  }

  // Verify password
  if (
    typeof password !== "string" ||
    password.length > parseInt(process.env.PWD_MAX_LENGTH) ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    throw new Error(
      `The admin password to ${
        editProtectedItem ? "mutate" : "enable protection on"
      } this item is incorrect.`
    );
  }
}

module.exports = protectedValidation;
