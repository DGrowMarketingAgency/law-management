const db = require("../config/database");

/**
 * Aggregated Daily / Range Cause List
 * Grouped structure:
 * Court -> Hearing Time -> Case
 */
const getCauseList = async ({
  date = "",
  date_from = "",
  date_to = "",
  court_id = "",
  status = "SCHEDULED",
  assigned_user_id = "",
  userId = null,
  isOwner = false,
  isSenior = false,
} = {}) => {
  const whereClauses = ["cs.deleted_at IS NULL"];
  const params = [];

  // Two-layer resource authorization: Junior sees only assigned cases
  if (!isOwner && !isSenior && userId) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM case_assignments ca_user WHERE ca_user.case_id = cs.id AND ca_user.user_id = ? AND ca_user.is_active = 1)`
    );
    params.push(userId);
  }

  // Date Filtering
  if (date) {
    whereClauses.push("ch.hearing_date = ?");
    params.push(date);
  } else if (date_from || date_to) {
    if (date_from) {
      whereClauses.push("ch.hearing_date >= ?");
      params.push(date_from);
    }
    if (date_to) {
      whereClauses.push("ch.hearing_date <= ?");
      params.push(date_to);
    }
  } else {
    // Default server date: Today
    whereClauses.push("ch.hearing_date = CURDATE()");
  }

  if (status) {
    whereClauses.push("ch.status = ?");
    params.push(status);
  }

  if (court_id) {
    whereClauses.push("ch.court_id = ?");
    params.push(court_id);
  }

  if (assigned_user_id) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM case_assignments ca_flt WHERE ca_flt.case_id = cs.id AND ca_flt.user_id = ? AND ca_flt.is_active = 1)`
    );
    params.push(assigned_user_id);
  }

  const query = `
    SELECT 
      ch.id as hearing_id, ch.hearing_date, ch.hearing_time, ch.hearing_type, ch.courtroom, ch.judge, ch.purpose, ch.status as hearing_status, ch.remarks,
      crt.id as court_id, COALESCE(crt.name, 'Chambers / Unassigned Court') as court_name, crt.court_type, crt.city as court_city,
      cs.id as case_id, cs.case_number, cs.cnr_number, cs.title as case_title, cs.case_stage,
      cl.client_code, cl_cnt.display_name as client_name
    FROM case_hearings ch
    JOIN cases cs ON ch.case_id = cs.id
    LEFT JOIN courts crt ON ch.court_id = crt.id
    JOIN clients cl ON cs.primary_client_id = cl.id
    JOIN contacts cl_cnt ON cl.contact_id = cl_cnt.id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY crt.name ASC, ch.hearing_date ASC, (ch.hearing_time IS NULL) ASC, ch.hearing_time ASC, cs.case_number ASC
  `;

  const [rows] = await db.execute(query, params);

  // Group by Court -> Hearings
  const courtsMap = {};
  rows.forEach((r) => {
    const courtKey = r.court_id || 0;
    if (!courtsMap[courtKey]) {
      courtsMap[courtKey] = {
        court: {
          id: r.court_id,
          name: r.court_name,
          courtType: r.court_type,
          city: r.court_city,
        },
        hearings: [],
      };
    }

    courtsMap[courtKey].hearings.push({
      hearingId: r.hearing_id,
      hearingDate: r.hearing_date,
      time: r.hearing_time ? String(r.hearing_time).slice(0, 5) : null,
      rawTime: r.hearing_time,
      hearingType: r.hearing_type,
      courtroom: r.courtroom,
      judge: r.judge,
      purpose: r.purpose,
      status: r.hearing_status,
      remarks: r.remarks,
      case: {
        id: r.case_id,
        caseNumber: r.case_number,
        cnrNumber: r.cnr_number,
        title: r.case_title,
        stage: r.case_stage,
        clientName: r.client_name,
        clientCode: r.client_code,
      },
    });
  });

  return {
    date: date || (date_from ? `${date_from} to ${date_to}` : new Date().toISOString().slice(0, 10)),
    totalHearings: rows.length,
    courts: Object.values(courtsMap),
  };
};

module.exports = {
  getCauseList,
};
