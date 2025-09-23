const { Router } = require("express");
const doughsController = require("../controllers/doughsController.js");

const router = Router();

router.get("/new", doughsController.getNew);
router.post("/new", doughsController.postNew);
router.get("/:id/edit", doughsController.getEditById);
router.post("/:id/edit", doughsController.postEditById);
router.get("/:id/delete", doughsController.getDeleteById);
router.post("/:id/delete", doughsController.postDeleteById);
router.get("/:id/restock", doughsController.getRestockById);
router.post("/:id/restock", doughsController.postRestockById);
router.get("/:id", doughsController.getById);
router.get("/", doughsController.get);

module.exports = router;
