const crmDashboardService = require("../services/crmDashboardService");
const { successResponse } = require("../utils/apiResponse");

const getDashboard = async (req, res, next) => {
  try {
    const isOwner = req.user?.isOwner || req.user?.roles?.includes("OWNER");
    const data = await crmDashboardService.getCRMDashboardStats(req.user.id, isOwner);
    return successResponse(res, "CRM dashboard statistics retrieved.", data, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
};
