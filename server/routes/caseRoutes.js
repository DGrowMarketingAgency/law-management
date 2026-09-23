const express = require("express");
const caseController = require("../controllers/caseController");
const hearingController = require("../controllers/hearingController");
const caseSub = require("../controllers/caseDetailSubController");
const deadlineController = require("../controllers/deadlineController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const authorizeCaseAccess = require("../middleware/authorizeCaseAccess");
const requireVaultUnlock = require("../middleware/requireVaultUnlock");

const router = express.Router();

router.use(authenticate);

// --- CASE LEVEL ROUTES ---
router.get("/dashboard", authorize("CASE_VIEW"), caseController.getDashboard);
router.get("/", authorize("CASE_VIEW"), caseController.getCases);
router.post("/", authorize("CASE_CREATE"), caseController.createCase);

router.get(
  "/:id",
  authorize("CASE_VIEW"),
  authorizeCaseAccess("VIEW"),
  caseController.getCaseById,
);
router.patch(
  "/:id",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseController.updateCase,
);
router.delete(
  "/:id",
  authorize("CASE_DELETE"),
  authorizeCaseAccess("EDIT"),
  caseController.deleteCase,
);

// --- PARTIES SUB-ROUTES ---
router.get(
  "/:caseId/parties",
  authorize("CASE_VIEW"),
  authorizeCaseAccess("VIEW"),
  caseSub.getParties,
);
router.post(
  "/:caseId/parties",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseSub.addParty,
);
router.patch(
  "/:caseId/parties/:partyId",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseSub.updateParty,
);
router.delete(
  "/:caseId/parties/:partyId",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseSub.removeParty,
);

// --- COUNSEL SUB-ROUTES ---
router.get(
  "/:caseId/counsel",
  authorize("CASE_VIEW"),
  authorizeCaseAccess("VIEW"),
  caseSub.getCounsel,
);
router.post(
  "/:caseId/counsel",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseSub.addCounsel,
);
router.patch(
  "/:caseId/counsel/:counselId",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseSub.updateCounsel,
);
router.delete(
  "/:caseId/counsel/:counselId",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("EDIT"),
  caseSub.removeCounsel,
);

// --- ASSIGNMENTS SUB-ROUTES ---
router.get(
  "/:caseId/assignments",
  authorize("CASE_VIEW"),
  authorizeCaseAccess("VIEW"),
  caseSub.getAssignments,
);
router.post(
  "/:caseId/assignments",
  authorize("CASE_ASSIGN"),
  authorizeCaseAccess("EDIT"),
  caseSub.assignUser,
);
router.delete(
  "/:caseId/assignments/:assignmentId",
  authorize("CASE_ASSIGN"),
  authorizeCaseAccess("EDIT"),
  caseSub.unassignUser,
);

// --- NOTES SUB-ROUTES ---
router.get(
  "/:caseId/notes",
  authorize("CASE_VIEW"),
  authorizeCaseAccess("VIEW"),
  caseSub.getNotes,
);
router.post(
  "/:caseId/notes",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("VIEW"),
  caseSub.createNote,
);
router.patch(
  "/:caseId/notes/:noteId",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("VIEW"),
  caseSub.updateNote,
);
router.delete(
  "/:caseId/notes/:noteId",
  authorize("CASE_UPDATE"),
  authorizeCaseAccess("VIEW"),
  caseSub.deleteNote,
);

// --- HEARINGS SUB-ROUTES ---
router.get(
  "/:caseId/hearings",
  authorize("HEARING_VIEW"),
  authorizeCaseAccess("VIEW"),
  hearingController.getHearings,
);
router.post(
  "/:caseId/hearings",
  authorize("HEARING_CREATE"),
  authorizeCaseAccess("EDIT"),
  hearingController.createHearing,
);
router.get(
  "/:caseId/hearings/:hearingId",
  authorize("HEARING_VIEW"),
  authorizeCaseAccess("VIEW"),
  hearingController.getHearingById,
);
router.patch(
  "/:caseId/hearings/:hearingId",
  authorize("HEARING_UPDATE"),
  authorizeCaseAccess("EDIT"),
  hearingController.updateHearing,
);
router.post(
  "/:caseId/hearings/:hearingId/adjourn",
  authorize("HEARING_ADJOURN"),
  authorizeCaseAccess("EDIT"),
  hearingController.adjournHearing,
);
router.delete(
  "/:caseId/hearings/:hearingId",
  authorize("HEARING_DELETE"),
  authorizeCaseAccess("EDIT"),
  hearingController.deleteHearing,
);

// --- LIMITATION DEADLINES SUB-ROUTES ---
router.get(
  "/:caseId/deadlines",
  authorize("DEADLINE_VIEW"),
  authorizeCaseAccess("VIEW"),
  deadlineController.getCaseDeadlines,
);
router.post(
  "/:caseId/deadlines",
  authorize("DEADLINE_CREATE"),
  authorizeCaseAccess("EDIT"),
  deadlineController.createCaseDeadline,
);
router.get(
  "/:caseId/deadlines/:deadlineId",
  authorize("DEADLINE_VIEW"),
  authorizeCaseAccess("VIEW"),
  deadlineController.getDeadlineById,
);
router.post(
  "/:caseId/deadlines/:deadlineId/override",
  authorize("DEADLINE_OVERRIDE"),
  authorizeCaseAccess("EDIT"),
  deadlineController.overrideCaseDeadline,
);
router.post(
  "/:caseId/deadlines/:deadlineId/complete",
  authorize("DEADLINE_COMPLETE"),
  authorizeCaseAccess("EDIT"),
  deadlineController.completeCaseDeadline,
);
// --- DOCUMENTS SUB-ROUTES ---
const { uploadMiddleware } = require("./documentRoutes");
const documentController = require("../controllers/documentController");
router.get(
  "/:caseId/documents",
  authorize("DOCUMENT_VIEW"),
  authorizeCaseAccess("VIEW"),
  documentController.getCaseDocuments,
);
router.post(
  "/:caseId/documents",
  authorize("DOCUMENT_CREATE"),
  authorizeCaseAccess("EDIT"),
  requireVaultUnlock,
  uploadMiddleware.single("file"),
  documentController.createDocument,
);

module.exports = router;
