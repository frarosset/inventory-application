const { body } = require("express-validator");
const db = require("../../db/queries.js");

const protectedValidation = [
  body("password").custom(async (password, { req }) => {
    if (req.locals.isNew) {
      if (req.body.is_protected) {
        checkPassword(req.body.password);
      }
    } else if (req.locals.isEdit) {
      const isItemProtected = await checkIfItemIsProtected(req);

      // Check if the item is protected
      if (isItemProtected) {
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

async function checkIfItemIsProtected(req) {
  const baseUrl = req.baseUrl;

  const dbRead =
    baseUrl === "/pizzas"
      ? db.read.pizzaProtected
      : baseUrl === "/ingredients"
      ? db.read.ingredientProtected
      : baseUrl === "/categories"
      ? db.read.categoryProtected
      : null;

  const is_protected = await dbRead(req.params.id);

  return is_protected;
}

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
