const contactService = require("../services/contactService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getContacts = async (req, res, next) => {
  try {
    const { page, limit, search, contact_type, sort, order } = req.query;
    const result = await contactService.getContacts({ page, limit, search, contact_type, sort, order });
    return successResponse(res, "Contacts retrieved successfully.", result, 200);
  } catch (error) {
    next(error);
  }
};

const createContact = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const contact = await contactService.createContact(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Contact created successfully.", { contact }, 201);
  } catch (error) {
    next(error);
  }
};

const getContactById = async (req, res, next) => {
  try {
    const contact = await contactService.getContactById(req.params.id);
    return successResponse(res, "Contact details retrieved.", { contact }, 200);
  } catch (error) {
    next(error);
  }
};

const updateContact = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const contact = await contactService.updateContact(req.params.id, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Contact updated successfully.", { contact }, 200);
  } catch (error) {
    next(error);
  }
};

const deleteContact = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await contactService.deleteContact(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const address = await contactService.addContactAddress(req.params.id, req.body);
    return successResponse(res, "Address added successfully.", { address }, 201);
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    await contactService.deleteContactAddress(req.params.id, req.params.addressId);
    return successResponse(res, "Address deleted successfully.", {}, 200);
  } catch (error) {
    next(error);
  }
};

const getTags = async (req, res, next) => {
  try {
    const tags = await contactService.getAllTags();
    return successResponse(res, "Contact tags retrieved.", { tags }, 200);
  } catch (error) {
    next(error);
  }
};

const createTag = async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return errorResponse(res, "Tag name is required.", "MISSING_TAG_NAME", null, 400);
    }
    const tag = await contactService.createTag(name, color);
    return successResponse(res, "Tag created successfully.", { tag }, 201);
  } catch (error) {
    next(error);
  }
};

const addTag = async (req, res, next) => {
  try {
    await contactService.addContactTag(req.params.id, req.params.tagId || req.body.tag_id);
    return successResponse(res, "Tag attached to contact.", {}, 200);
  } catch (error) {
    next(error);
  }
};

const removeTag = async (req, res, next) => {
  try {
    await contactService.removeContactTag(req.params.id, req.params.tagId);
    return successResponse(res, "Tag removed from contact.", {}, 200);
  } catch (error) {
    next(error);
  }
};

const getTimeline = async (req, res, next) => {
  try {
    const timeline = await contactService.getContactTimeline(req.params.id);
    return successResponse(res, "Contact timeline retrieved.", { timeline }, 200);
  } catch (error) {
    next(error);
  }
};

const getCases = async (req, res) => {
  return successResponse(res, "Cases module will be implemented in Prompt 5.", { cases: [] }, 200);
};

const getInvoices = async (req, res) => {
  return successResponse(res, "Billing & Invoicing module will be implemented in a future prompt.", { invoices: [] }, 200);
};

module.exports = {
  getContacts,
  createContact,
  getContactById,
  updateContact,
  deleteContact,
  addAddress,
  deleteAddress,
  getTags,
  createTag,
  addTag,
  removeTag,
  getTimeline,
  getCases,
  getInvoices,
};
