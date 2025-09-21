const db = require("../db/queries.js");
const asyncHandler = require("express-async-handler");
const idValidator = require("./validation/idValidator.js");
const CustomNotFoundError = require("../errors/CustomNotFoundError");
const formatCost = require("./scripts/formatCost.js");

const err404Msg = {
  getById: "This dough does not exist!",
  getEditById: "Cannot edit — this dough does not exist!",
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
