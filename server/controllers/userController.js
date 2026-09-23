const userService = require("../services/userService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

/**
 * GET /api/v1/users
 */
const getUsers = async (req, res, next) => {
  try {
    const { search, status, role, page, limit } = req.query;
    const users = await userService.getUsers({ search, status, role, page, limit });
    return successResponse(res, "Users retrieved successfully.", { users }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return successResponse(res, "User details retrieved successfully.", { user }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/users
 */
const createUser = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const newUser = await userService.createUser(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Chambers user created successfully.", { user: newUser }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body, req.user.id);
    return successResponse(res, "User profile updated successfully.", { user: updatedUser }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/:id/status
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return errorResponse(res, "Status is required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const updatedUser = await userService.updateUserStatus(req.params.id, status, req.user.id, ip, userAgent);
    return successResponse(res, "User status updated successfully.", { user: updatedUser }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/:id/roles
 */
const updateUserRoles = async (req, res, next) => {
  try {
    const { roles } = req.body;
    if (!roles) {
      return errorResponse(res, "Roles array is required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const updatedUser = await userService.updateUserRoles(req.params.id, roles, req.user.id, ip, userAgent);
    return successResponse(res, "User roles updated successfully.", { user: updatedUser }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await userService.deleteUser(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateUserRoles,
  deleteUser,
};
