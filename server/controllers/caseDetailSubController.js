const casePartyService = require("../services/casePartyService");
const caseCounselService = require("../services/caseCounselService");
const caseAssignmentService = require("../services/caseAssignmentService");
const caseNoteService = require("../services/caseNoteService");
const { canAccessCaseNote } = require("../services/authorizationService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

// --- PARTIES ---
const getParties = async (req, res, next) => {
  try {
    const parties = await casePartyService.getPartiesByCaseId(req.params.caseId);
    return successResponse(res, "Parties retrieved.", { parties }, 200);
  } catch (error) {
    next(error);
  }
};

const addParty = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const party = await casePartyService.addParty(req.params.caseId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Party added to case.", { party }, 201);
  } catch (error) {
    next(error);
  }
};

const updateParty = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const party = await casePartyService.updateParty(req.params.caseId, req.params.partyId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Party updated.", { party }, 200);
  } catch (error) {
    next(error);
  }
};

const removeParty = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await casePartyService.removeParty(req.params.caseId, req.params.partyId, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

// --- COUNSEL ---
const getCounsel = async (req, res, next) => {
  try {
    const counsel = await caseCounselService.getCounselByCaseId(req.params.caseId);
    return successResponse(res, "Counsel retrieved.", { counsel }, 200);
  } catch (error) {
    next(error);
  }
};

const addCounsel = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const counsel = await caseCounselService.addCounsel(req.params.caseId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Counsel added to case.", { counsel }, 201);
  } catch (error) {
    next(error);
  }
};

const updateCounsel = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const counsel = await caseCounselService.updateCounsel(req.params.caseId, req.params.counselId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Counsel updated.", { counsel }, 200);
  } catch (error) {
    next(error);
  }
};

const removeCounsel = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await caseCounselService.removeCounsel(req.params.caseId, req.params.counselId, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

// --- ASSIGNMENTS ---
const getAssignments = async (req, res, next) => {
  try {
    const assignments = await caseAssignmentService.getAssignmentsByCaseId(req.params.caseId);
    return successResponse(res, "Assignments retrieved.", { assignments }, 200);
  } catch (error) {
    next(error);
  }
};

const assignUser = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const assignment = await caseAssignmentService.assignUserToCase(req.params.caseId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "User assigned to case.", { assignment }, 201);
  } catch (error) {
    next(error);
  }
};

const unassignUser = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await caseAssignmentService.unassignUserFromCase(req.params.caseId, req.params.assignmentId, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

// --- NOTES ---
const getNotes = async (req, res, next) => {
  try {
    const isPrivileged = req.user.isOwner || (req.user.roles && (req.user.roles.includes("OWNER") || req.user.roles.includes("SENIOR_ASSOCIATE")));
    const notes = await caseNoteService.getNotesByCaseId(req.params.caseId, isPrivileged);
    return successResponse(res, "Case notes retrieved.", { notes }, 200);
  } catch (error) {
    next(error);
  }
};

const createNote = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const { note_type } = req.body;

    // Check permission for sensitive note types
    if (["STRATEGY", "INTERNAL"].includes(note_type)) {
      const canAccess = await canAccessCaseNote(req.user.id, req.params.caseId, note_type);
      if (!canAccess) {
        return errorResponse(res, "You lack authorization to create internal strategy notes.", "FORBIDDEN_NOTE_TYPE", null, 403);
      }
    }

    const note = await caseNoteService.createNote(req.params.caseId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Case note added.", { note }, 201);
  } catch (error) {
    next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const note = await caseNoteService.updateNote(req.params.noteId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Case note updated.", { note }, 200);
  } catch (error) {
    next(error);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await caseNoteService.deleteNote(req.params.noteId, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getParties,
  addParty,
  updateParty,
  removeParty,
  getCounsel,
  addCounsel,
  updateCounsel,
  removeCounsel,
  getAssignments,
  assignUser,
  unassignUser,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
};
