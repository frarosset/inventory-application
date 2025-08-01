const { Router } = require("express");
const categoriesController = require("../controllers/categoriesController.js");

const router = Router();

router.get("/", categoriesController.get);
router.get("/new", categoriesController.getNew);
router.get("/:id", categoriesController.getById);

module.exports = router;
