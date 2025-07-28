const { Router } = require("express");
const pizzasController = require("../controllers/pizzasController.js");

const router = Router();

router.get("/", pizzasController.get);
router.get("/new", pizzasController.getNew);
router.post("/new", pizzasController.postNew);
router.get("/:id", pizzasController.getById);

module.exports = router;
