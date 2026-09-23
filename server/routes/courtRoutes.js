const express = require("express");
const courtController = require("../controllers/courtController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("COURT_VIEW"), courtController.getCourts);
router.post("/", authorize("COURT_CREATE"), courtController.createCourt);
router.get("/:id", authorize("COURT_VIEW"), courtController.getCourtById);
router.patch("/:id", authorize("COURT_UPDATE"), courtController.updateCourt);
router.delete("/:id", authorize("COURT_DELETE"), courtController.deleteCourt);

module.exports = router;
