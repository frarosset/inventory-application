const { Router } = require("express");
const ingredientsController = require("../controllers/ingredientsController.js");

const router = Router();

router.get("/", ingredientsController.get);
router.get("/new", ingredientsController.getNew);
router.post("/new", ingredientsController.postNew);
router.get("/:id/edit", ingredientsController.getEditById);
router.post("/:id/edit", ingredientsController.postEditById);
router.get("/:id/delete", ingredientsController.getDeleteById);
router.post("/:id/delete", ingredientsController.postDeleteById);
router.get("/:id/restock", ingredientsController.getRestockById);
router.post("/:id/restock", ingredientsController.postRestockById);
router.get("/:id", ingredientsController.getById);

module.exports = router;
