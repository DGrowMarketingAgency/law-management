const db = require("../config/database");

/**
 * Recalculate and synchronize next_hearing_date on cases table
 * Finds the nearest future SCHEDULED hearing for the case.
 * If none exists, sets cases.next_hearing_date to NULL.
 * @param {number} caseId
 * @param {object} [connection] Optional transactional connection
 */
const updateNextHearingDate = async (caseId, connection = db) => {
  const query = `
    SELECT hearing_date
    FROM case_hearings
    WHERE case_id = ? 
      AND status = 'SCHEDULED' 
      AND hearing_date >= CURDATE()
    ORDER BY hearing_date ASC, (hearing_time IS NULL) ASC, hearing_time ASC
    LIMIT 1
  `;

  const [rows] = await connection.execute(query, [caseId]);
  const nextDate = rows.length > 0 ? rows[0].hearing_date : null;

  await connection.execute(`UPDATE cases SET next_hearing_date = ? WHERE id = ?`, [nextDate, caseId]);
  return nextDate;
};

module.exports = {
  updateNextHearingDate,
};
