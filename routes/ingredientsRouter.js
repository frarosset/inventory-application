const { Router } = require("express");
const ingredientsController = require("../controllers/ingredientsController.js");

const router = Router();

router.get("/", ingredientsController.get);

module.exports = router;
