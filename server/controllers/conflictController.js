const conflictService = require("../services/conflictService");
const { successResponse } = require("../utils/apiResponse");

const checkConflict = async (req, res, next) => {
  try {
    const source = (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
    const { name, phone, email, organization, exclude_contact_id } = source;
    const matches = await conflictService.checkContactConflict({
      name,
      phone,
      email,
      organization,
      excludeContactId: exclude_contact_id,
    });
    return successResponse(
      res,
      "Conflict check completed.",
      { possible_matches: matches, conflicts: matches, matchCount: matches.length },
      200
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkConflict,
};
