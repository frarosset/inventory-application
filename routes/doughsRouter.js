const { Router } = require("express");
const doughsController = require("../controllers/doughsController.js");

const router = Router();

router.get("/:id", doughsController.getById);
router.get("/", doughsController.get);

module.exports = router;
