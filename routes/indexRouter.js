const { Router } = require("express");
const indexController = require("../controllers/indexController.js");

const router = Router();

router.get("/", indexController.get);

module.exports = router;
