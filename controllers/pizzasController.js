const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const pizzaNewEditValidator = require("./validation/pizzaNewEditValidator.js");
const pizzaDeleteValidator = require("./validation/pizzaDeleteValidator.js");
const pizzaOrderValidator = require("./validation/pizzaOrderValidator.js");
const redirectToValidator = require("./validation/helpers/redirectToValidator.js");
const idValidator = require("./validation/helpers/idValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This pizza does not exist!",
  getEditById: "Cannot edit — this pizza does not exist!",
  getDeleteById: "Cannot delete — this pizza does not exist!",
  postDeleteById: "Cannot delete — this pizza does not exist!",
  postEditById: "Cannot edit — this pizza does not exist!",
  getOrderById: "Cannot order — this pizza does not exist!",
  postOrderById: "Cannot order — this pizza does not exist!",
};

exports.get = asyncHandler(async (req, res) => {
  const pizzasBriefData = await db.read.pizzasBrief();

  res.render("pizzas", {
    pageTitle: process.env.TITLE,
    pizzasBriefData,
    formatCost,
  });
});

exports.getById = [
  idValidator(err404Msg.getById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const pizzaData = await db.read.pizza(id);

    if (pizzaData == null) {
      throw new CustomNotFoundError(err404Msg.getById);
    }

    res.render("pizza", {
      pageTitle: process.env.TITLE,
      pizzaData,
      formatCost,
    });
  }),
];

exports.getNew = asyncHandler(async (req, res) => {
  const ingredients = await db.read.ingredientsNames();
  const categories = await db.read.categoriesNames();

  res.render("pizzaNewEdit", {
    pageTitle: process.env.TITLE,
    ingredients: ingredients.map((i) => i.name),
    categories: categories.map((i) => i.name),
  });
});

exports.postNew = [
  pizzaNewEditValidator,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.pizza(body);

    // this always redirect to the new pizza
    res.redirect("/pizzas/" + id);
  }),
];

exports.getEditById = [
  idValidator(err404Msg.getEditById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const pizzaData = await db.read.pizzaEdit(id);
    const ingredients = await db.read.ingredientsNames();
    const categories = await db.read.categoriesNames();

    if (pizzaData == null) {
      throw new CustomNotFoundError(err404Msg.getEditById);
    }

    res.render("pizzaNewEdit", {
      pageTitle: process.env.TITLE,
      ingredients: ingredients.map((i) => i.name),
      categories: categories.map((i) => i.name),
      data: pizzaData,
      edit: true,
    });
  }),
];

exports.postEditById = [
  idValidator(err404Msg.postEditById),
  pizzaNewEditValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const { id, updated } = await db.update.pizza(data);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postEditById);
    }
    res.redirect(data.redirectTo || "/pizzas/" + id);
  }),
];

exports.getDeleteById = [
  idValidator(err404Msg.getDeleteById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const pizzaData = await db.read.pizzaDelete(id);

    if (pizzaData == null) {
      throw new CustomNotFoundError(err404Msg.getDeleteById);
    }

    res.render("pizzaDelete", {
      pageTitle: process.env.TITLE,
      data: pizzaData,
    });
  }),
];

exports.postDeleteById = [
  idValidator(err404Msg.postDeleteById),
  pizzaDeleteValidator,
  (req, res, next) => {
    /* Exclude the route to the deleted item */
    const validator = redirectToValidator(`^/pizzas/${req.params.id}$`);
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const id = await db.delete.pizza(data.id);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postDeleteById);
    }

    res.redirect(data.redirectTo || "/pizzas");
  }),
];

exports.getOrderById = [
  idValidator(err404Msg.getOrderById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const pizzaData = await db.read.pizzaOrder(id);

    if (pizzaData == null) {
      throw new CustomNotFoundError(err404Msg.getOrderById);
    }

    res.render("pizzaOrder", {
      pageTitle: process.env.TITLE,
      data: pizzaData,
    });
  }),
];

exports.postOrderById = [
  idValidator(err404Msg.postOrderById),
  pizzaOrderValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    res.send("ordering" + JSON.stringify(data));
  }),
];
