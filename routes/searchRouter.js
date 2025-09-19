const { Router } = require("express");
const searchController = require("../controllers/searchController.js");

const router = Router();

router.get("/", searchController.get);

module.exports = router;
