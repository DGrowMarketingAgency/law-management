const causeListService = require("../services/causeListService");
const { successResponse } = require("../utils/apiResponse");

const getCauseList = async (req, res, next) => {
  try {
    const isOwner = req.user.isOwner || (req.user.roles && req.user.roles.includes("OWNER"));
    const isSenior = req.user.roles && req.user.roles.includes("SENIOR_ASSOCIATE");

    const { date, date_from, date_to, court_id, status, assigned_user_id } = req.query;

    const data = await causeListService.getCauseList({
      date,
      date_from,
      date_to,
      court_id,
      status,
      assigned_user_id,
      userId: req.user.id,
      isOwner,
      isSenior,
    });

    return successResponse(res, "Cause list retrieved.", data, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCauseList,
};
