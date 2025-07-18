const { Router } = require("express");
const categoriesController = require("../controllers/categoriesController.js");

const router = Router();

router.get("/", categoriesController.get);

module.exports = router;
