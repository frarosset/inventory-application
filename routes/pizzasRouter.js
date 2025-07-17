const { Router } = require("express");
const pizzasController = require("../controllers/pizzasController.js");

const router = Router();

router.get("/", pizzasController.get);

module.exports = router;
