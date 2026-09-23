const clientService = require("../services/clientService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getClients = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await clientService.getClients({ page, limit, search, status });
    return successResponse(res, "Clients retrieved successfully.", result, 200);
  } catch (error) {
    next(error);
  }
};

const createClient = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const client = await clientService.createClient(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Client onboarded successfully.", { client }, 201);
  } catch (error) {
    next(error);
  }
};

const getClientById = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    return successResponse(res, "Client details retrieved.", { client }, 200);
  } catch (error) {
    next(error);
  }
};

const updateClientStatus = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const client = await clientService.updateClientStatus(req.params.id, req.body.status, req.user.id, ip, userAgent);
    return successResponse(res, "Client status updated.", { client }, 200);
  } catch (error) {
    next(error);
  }
};

const getConsents = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    return successResponse(res, "Client consent history retrieved.", { consents: client.consents }, 200);
  } catch (error) {
    next(error);
  }
};

const recordConsent = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const consent = await clientService.recordClientConsent(req.params.id, req.body, req.user.id, ip);
    return successResponse(res, "Client consent recorded.", { consent }, 201);
  } catch (error) {
    next(error);
  }
};

const withdrawConsent = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const result = await clientService.withdrawClientConsent(req.params.id, req.params.consentId, req.user.id, ip);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClients,
  createClient,
  getClientById,
  updateClientStatus,
  getConsents,
  recordConsent,
  withdrawConsent,
};
