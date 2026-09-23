const appointmentService = require("../services/appointmentService");
const { successResponse } = require("../utils/apiResponse");

const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

const getAppointments = async (req, res, next) => {
  try {
    const { date, start_date, end_date, assigned_to, status, page, limit } = req.query;
    const result = await appointmentService.getAppointments({
      date,
      start_date,
      end_date,
      assigned_to,
      status,
      page,
      limit,
    });
    return successResponse(res, "Appointments retrieved.", result, 200);
  } catch (error) {
    next(error);
  }
};

const createAppointment = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const appointment = await appointmentService.createAppointment(req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Appointment scheduled successfully.", { appointment }, 201);
  } catch (error) {
    next(error);
  }
};

const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await appointmentService.getAppointmentById(req.params.id);
    return successResponse(res, "Appointment details retrieved.", { appointment }, 200);
  } catch (error) {
    next(error);
  }
};

const updateAppointment = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const appointment = await appointmentService.updateAppointment(req.params.id, req.body, req.user.id, ip, userAgent);
    return successResponse(res, "Appointment updated.", { appointment }, 200);
  } catch (error) {
    next(error);
  }
};

const deleteAppointment = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    await appointmentService.deleteAppointment(req.params.id, req.user.id, ip, userAgent);
    return successResponse(res, "Appointment cancelled/deleted.", {}, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAppointments,
  createAppointment,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
};
