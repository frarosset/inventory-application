const { body } = require("express-validator");
const db = require("../../db/queries.js");

const protectedValidation = [
  body("password").custom(async (password, { req }) => {
    if (req.locals.isNew) {
      if (req.body.is_protected) {
        checkPassword(req.body.password, "enable");
      }
    } else if (req.locals.isEdit) {
      const isItemProtected = await checkIfItemIsProtected(req);

      // Check if the item is protected
      if (isItemProtected) {
        checkPassword(req.body.password, "edit");
      } else {
        // if request to set item as protected
        if (req.body.is_protected) {
          checkPassword(req.body.password, "enable");
        }
      }
    } else if (req.locals.isDelete) {
      const isItemProtected = await checkIfItemIsProtected(req);
      // Check if the item is protected
      if (isItemProtected) {
        checkPassword(req.body.password, "delete");
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

function checkPassword(password, type) {
  if (!password) {
    throw new Error(
      `The admin password is required for ${
        type === "edit"
          ? "mutating"
          : type === "enable"
          ? "enabling protection on"
          : type === "delete"
          ? "deleting"
          : ""
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
        type === "edit"
          ? "mutate"
          : type === "enable"
          ? "enable protection on"
          : type === "delete"
          ? "delete"
          : ""
      } this item is incorrect.`
    );
  }
}

module.exports = protectedValidation;
