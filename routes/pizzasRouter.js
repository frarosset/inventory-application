const { Router } = require("express");
const pizzasController = require("../controllers/pizzasController.js");

const router = Router();

router.get("/", pizzasController.get);
router.get("/:id", pizzasController.getById);

module.exports = router;
