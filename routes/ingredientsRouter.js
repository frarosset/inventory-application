const { Router } = require("express");
const ingredientsController = require("../controllers/ingredientsController.js");

const router = Router();

router.get("/", ingredientsController.get);
router.get("/new", ingredientsController.getNew);
router.get("/:id", ingredientsController.getById);

module.exports = router;
