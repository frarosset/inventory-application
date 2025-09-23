const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const doughNewEditValidator = require("./validation/doughNewEditValidator.js");
const doughDeleteValidator = require("./validation/doughDeleteValidator.js");
const doughRestockValidator = require("./validation/doughRestockValidator.js");
const redirectToValidator = require("./validation/helpers/redirectToValidator.js");
const idValidator = require("./validation/helpers/idValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const CustomForbiddenError = require("../errors/CustomForbiddenError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This dough does not exist!",
  getDeleteById: "Cannot delete — this dough does not exist!",
  postDeleteById: "Cannot delete — this dough does not exist!",
  getDeleteByIdBaseForbidden: "Cannot delete the base dough!",
  getEditById: "Cannot edit — this dough does not exist!",
  postEditById: "Cannot edit — this dough does not exist!",
  getRestockById: "Cannot restock — this dough does not exist!",
  postRestockById: "Cannot restock — this dough does not exist!",
};

exports.get = asyncHandler(async (req, res) => {
  const doughsBriefData = await db.read.doughsBrief();

  res.render("doughs", {
    pageTitle: process.env.TITLE,
    doughsBriefData,
    formatCost,
  });
});

exports.getById = [
  idValidator(err404Msg.getById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doughData = await db.read.dough(id);

    if (doughData == null) {
      throw new CustomNotFoundError(err404Msg.getById);
    }

    res.render("dough", {
      pageTitle: process.env.TITLE,
      doughData,
      formatCost,
    });
  }),
];

exports.getNew = asyncHandler(async (req, res) => {
  res.render("doughNewEdit", {
    pageTitle: process.env.TITLE,
  });
});

exports.postNew = [
  doughNewEditValidator,
  asyncHandler(async (req, res) => {
    const body = matchedData(req); // req.body

    const id = await db.create.dough(body);

    // this always redirect to the new dough
    res.redirect("/doughs/" + id);
  }),
];

exports.getEditById = [
  idValidator(err404Msg.getEditById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doughData = await db.read.doughEdit(id);

    if (doughData == null) {
      throw new CustomNotFoundError(err404Msg.getEditById);
    }

    res.render("doughNewEdit", {
      pageTitle: process.env.TITLE,
      data: doughData,
      edit: true,
    });
  }),
];

exports.postEditById = [
  idValidator(err404Msg.postEditById),
  doughNewEditValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const { id, updated } = await db.update.dough(data);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postEditById);
    }

    res.redirect(data.redirectTo || "/doughs/" + id);
  }),
];

exports.getDeleteById = [
  idValidator(err404Msg.getDeleteById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (id === Number(process.env.BASE_DOUGH_ID)) {
      throw new CustomForbiddenError(err404Msg.getDeleteByIdBaseForbidden);
    }

    const doughData = await db.read.doughDelete(id);

    if (doughData == null) {
      throw new CustomNotFoundError(err404Msg.getDeleteById);
    }

    res.render("doughDelete", {
      pageTitle: process.env.TITLE,
      data: doughData,
    });
  }),
];

exports.postDeleteById = [
  idValidator(err404Msg.postDeleteById),
  doughDeleteValidator,
  (req, res, next) => {
    /* Exclude the route to the deleted item */
    const validator = redirectToValidator(`^/doughs/${req.params.id}$`);
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    if (data.id === Number(process.env.BASE_DOUGH_ID)) {
      throw new CustomForbiddenError(err404Msg.getDeleteByIdBaseForbidden);
    }

    const id = await db.delete.dough(data.id);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postDeleteById);
    }

    res.redirect(data.redirectTo || "/doughs");
  }),
];

exports.getRestockById = [
  idValidator(err404Msg.getRestockById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doughData = await db.read.doughRestock(id);

    if (doughData == null) {
      throw new CustomNotFoundError(err404Msg.getRestockById);
    }

    res.render("doughRestock", {
      pageTitle: process.env.TITLE,
      data: doughData,
    });
  }),
];

exports.postRestockById = [
  idValidator(err404Msg.postRestockById),
  doughRestockValidator,
  (req, res, next) => {
    const validator = redirectToValidator();
    return validator(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const data = matchedData(req); // req.body + req.params.id

    const { id, updated } = await db.update.doughRestock(data);

    if (id == null) {
      throw new CustomNotFoundError(err404Msg.postRestockById);
    }

    res.redirect(data.redirectTo || "/doughs/" + id);
  }),
];
