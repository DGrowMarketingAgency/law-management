const express = require("express");
const causeListController = require("../controllers/causeListController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("CAUSELIST_VIEW"), causeListController.getCauseList);

module.exports = router;
