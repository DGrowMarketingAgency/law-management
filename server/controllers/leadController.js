const leadService = require("../services/leadService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getLeads = async (req, res, next) => {
  try {
    const { page, limit, status, assigned_to, search } = req.query;
    const result = await leadService.getLeads({ page, limit, status, assigned_to, search });
    return successResponse(res, "Leads retrieved successfully.", result, 200);
  } catch (error) {
    next(error);
  }
};

const createLead = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const lead = await leadService.createLead(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Lead inquiry created successfully.", { lead }, 201);
  } catch (error) {
    next(error);
  }
};

const getLeadById = async (req, res, next) => {
  try {
    const lead = await leadService.getLeadById(req.params.id);
    return successResponse(res, "Lead details retrieved.", { lead }, 200);
  } catch (error) {
    next(error);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const lead = await leadService.updateLead(req.params.id, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Lead updated successfully.", { lead }, 200);
  } catch (error) {
    next(error);
  }
};

const convertLead = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await leadService.convertLeadToClient(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, result.message, { client: result.client }, 200);
  } catch (error) {
    next(error);
  }
};

const addActivity = async (req, res, next) => {
  try {
    const activity = await leadService.addLeadActivity(req.params.id, req.body, req.user.id);
    return successResponse(res, "Activity recorded.", { activity }, 201);
  } catch (error) {
    next(error);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const lead = await leadService.getLeadById(req.params.id);
    return successResponse(res, "Lead activities retrieved.", { activities: lead.activities }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeads,
  createLead,
  getLeadById,
  updateLead,
  convertLead,
  addActivity,
  getActivities,
};
