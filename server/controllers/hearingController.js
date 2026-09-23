const hearingService = require("../services/hearingService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getHearings = async (req, res, next) => {
  try {
    const { date_from, date_to, status } = req.query;
    const hearings = await hearingService.getHearingsByCaseId(req.params.caseId, { date_from, date_to, status });
    return successResponse(res, "Hearings retrieved.", { hearings }, 200);
  } catch (error) {
    next(error);
  }
};

const getHearingById = async (req, res, next) => {
  try {
    const hearing = await hearingService.getHearingById(req.params.hearingId);
    return successResponse(res, "Hearing details retrieved.", { hearing }, 200);
  } catch (error) {
    next(error);
  }
};

const createHearing = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const hearing = await hearingService.createHearing(req.params.caseId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Hearing scheduled successfully.", { hearing }, 201);
  } catch (error) {
    next(error);
  }
};

const updateHearing = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const hearing = await hearingService.updateHearing(req.params.hearingId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Hearing updated successfully.", { hearing }, 200);
  } catch (error) {
    next(error);
  }
};

const adjournHearing = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await hearingService.adjournHearing(req.params.hearingId, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Hearing adjourned successfully.", result, 200);
  } catch (error) {
    next(error);
  }
};

const deleteHearing = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await hearingService.deleteHearing(req.params.hearingId, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHearings,
  getHearingById,
  createHearing,
  updateHearing,
  adjournHearing,
  deleteHearing,
};
