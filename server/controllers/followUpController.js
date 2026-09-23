const followUpService = require("../services/followUpService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getFollowUps = async (req, res, next) => {
  try {
    const { status, assigned_to, contact_id, client_id, lead_id, page, limit } = req.query;
    const result = await followUpService.getFollowUps({
      status,
      assigned_to,
      contact_id,
      client_id,
      lead_id,
      page,
      limit,
    });
    return successResponse(res, "Follow-ups retrieved.", result, 200);
  } catch (error) {
    next(error);
  }
};

const createFollowUp = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const followUp = await followUpService.createFollowUp(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Follow-up scheduled.", { followUp }, 201);
  } catch (error) {
    next(error);
  }
};

const getFollowUpById = async (req, res, next) => {
  try {
    const followUp = await followUpService.getFollowUpById(req.params.id);
    return successResponse(res, "Follow-up retrieved.", { followUp }, 200);
  } catch (error) {
    next(error);
  }
};

const updateFollowUp = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const followUp = await followUpService.updateFollowUp(req.params.id, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Follow-up updated.", { followUp }, 200);
  } catch (error) {
    next(error);
  }
};

const deleteFollowUp = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    await followUpService.deleteFollowUp(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, "Follow-up removed.", {}, 200);
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const isOwner = req.user?.isOwner || req.user?.roles?.includes("OWNER");
    const dashboard = await followUpService.getFollowUpsDashboard(req.user.id, isOwner);
    return successResponse(res, "Follow-up dashboard data retrieved.", { dashboard }, 200);
  } catch (error) {
    next(error);
  }
};

const completeFollowUp = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const { outcome_notes } = req.body;
    const followUp = await followUpService.completeFollowUp(req.params.id, outcome_notes, req.user.id, ip, userAgent);
    return successResponse(res, "Follow-up marked as completed.", { followUp }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFollowUps,
  createFollowUp,
  getFollowUpById,
  updateFollowUp,
  completeFollowUp,
  deleteFollowUp,
  getDashboard,
  getSummary: getDashboard,
};
