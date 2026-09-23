const caseService = require("../services/caseService");
const caseDashboardService = require("../services/caseDashboardService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getCases = async (req, res, next) => {
  try {
    const isOwner = req.user.isOwner || (req.user.roles && req.user.roles.includes("OWNER"));
    const isSenior = req.user.roles && req.user.roles.includes("SENIOR_ASSOCIATE");
    const {
      page,
      limit,
      search,
      cnr_number,
      case_number,
      client_id,
      court_id,
      case_type,
      case_stage,
      case_status,
      assigned_user_id,
      has_upcoming_hearing,
    } = req.query;

    const result = await caseService.getCases({
      page,
      limit,
      search,
      cnr_number,
      case_number,
      client_id,
      court_id,
      case_type,
      case_stage,
      case_status,
      assigned_user_id,
      has_upcoming_hearing,
      userId: req.user.id,
      isOwner,
      isSenior,
    });

    return successResponse(res, "Cases retrieved.", result, 200);
  } catch (error) {
    next(error);
  }
};

const getCaseById = async (req, res, next) => {
  try {
    const caseData = await caseService.getCaseById(req.params.id);
    return successResponse(res, "Case dossier retrieved.", { case: caseData }, 200);
  } catch (error) {
    next(error);
  }
};

const createCase = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const caseData = await caseService.createCase(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Case opened successfully.", { case: caseData }, 201);
  } catch (error) {
    next(error);
  }
};

const updateCase = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const caseData = await caseService.updateCase(req.params.id, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Case updated successfully.", { case: caseData }, 200);
  } catch (error) {
    next(error);
  }
};

const deleteCase = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await caseService.deleteCase(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const isOwner = req.user.isOwner || (req.user.roles && req.user.roles.includes("OWNER"));
    const isSenior = req.user.roles && req.user.roles.includes("SENIOR_ASSOCIATE");
    const stats = await caseDashboardService.getCaseDashboardStats(req.user.id, isOwner, isSenior);
    return successResponse(res, "Case dashboard statistics retrieved.", stats, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  getDashboard,
};
