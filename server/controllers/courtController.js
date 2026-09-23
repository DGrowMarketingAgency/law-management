const courtService = require("../services/courtService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getCourts = async (req, res, next) => {
  try {
    const { page, limit, search, court_type, city, state, is_active } = req.query;
    const result = await courtService.getCourts({ page, limit, search, court_type, city, state, is_active });
    return successResponse(res, "Courts retrieved.", result, 200);
  } catch (error) {
    next(error);
  }
};

const getCourtById = async (req, res, next) => {
  try {
    const court = await courtService.getCourtById(req.params.id);
    return successResponse(res, "Court details retrieved.", { court }, 200);
  } catch (error) {
    next(error);
  }
};

const createCourt = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const court = await courtService.createCourt(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Court registered successfully.", { court }, 201);
  } catch (error) {
    next(error);
  }
};

const updateCourt = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const court = await courtService.updateCourt(req.params.id, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Court updated successfully.", { court }, 200);
  } catch (error) {
    next(error);
  }
};

const deleteCourt = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await courtService.deleteCourt(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
};
