const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const doughNewEditValidator = require("./validation/doughNewEditValidator.js");
const redirectToValidator = require("./validation/helpers/redirectToValidator.js");
const idValidator = require("./validation/helpers/idValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const { matchedData } = require("express-validator");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This dough does not exist!",
  getEditById: "Cannot edit — this dough does not exist!",
  postEditById: "Cannot edit — this dough does not exist!",
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

exports.getEditById = [
  idValidator(err404Msg.getEditById),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doughData = await db.read.doughEdit(id);

    if (doughData == null) {
      throw new CustomNotFoundError(err404Msg.getEditById);
    }

    res.render("doughMutation", {
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
