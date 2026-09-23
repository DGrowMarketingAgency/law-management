const express = require("express");
const contactController = require("../controllers/contactController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("CONTACT_VIEW"), contactController.getContacts);
router.post("/", authorize("CONTACT_CREATE"), contactController.createContact);
router.get("/:id", authorize("CONTACT_VIEW"), contactController.getContactById);
router.patch("/:id", authorize("CONTACT_UPDATE"), contactController.updateContact);
router.delete("/:id", authorize("CONTACT_DELETE"), contactController.deleteContact);

router.get("/:id/timeline", authorize("CONTACT_VIEW"), contactController.getTimeline);
router.get("/:id/cases", authorize("CONTACT_VIEW"), contactController.getCases);
router.get("/:id/invoices", authorize("CONTACT_VIEW"), contactController.getInvoices);

router.post("/:id/addresses", authorize("CONTACT_UPDATE"), contactController.addAddress);
router.delete("/:id/addresses/:addressId", authorize("CONTACT_UPDATE"), contactController.deleteAddress);

router.post("/:id/tags", authorize("CONTACT_UPDATE"), contactController.addTag);
router.delete("/:id/tags/:tagId", authorize("CONTACT_UPDATE"), contactController.removeTag);

module.exports = router;
