const db = require("../config/database");

/**
 * Case Dashboard Aggregated Analytics with authorization scoping
 */
const getCaseDashboardStats = async (userId = null, isOwner = false, isSenior = false) => {
  let userScope = "";
  const params = [];

  if (!isOwner && !isSenior && userId) {
    userScope = `AND EXISTS (SELECT 1 FROM case_assignments ca_scope WHERE ca_scope.case_id = cs.id AND ca_scope.user_id = ? AND ca_scope.is_active = 1)`;
    params.push(userId);
  }

  // 1. Status breakdown
  const [statusRows] = await db.execute(
    `SELECT cs.case_status, COUNT(*) as count
     FROM cases cs
     WHERE cs.deleted_at IS NULL ${userScope}
     GROUP BY cs.case_status`,
    params
  );

  const statusMap = {
    ACTIVE: 0,
    STAYED: 0,
    CLOSED: 0,
    DISPOSED: 0,
    TRANSFERRED: 0,
    WITHDRAWN: 0,
  };
  let totalCases = 0;
  statusRows.forEach((r) => {
    statusMap[r.case_status] = r.count;
    totalCases += r.count;
  });

  // 2. Stage breakdown
  const [stageRows] = await db.execute(
    `SELECT cs.case_stage, COUNT(*) as count
     FROM cases cs
     WHERE cs.deleted_at IS NULL AND cs.case_status = 'ACTIVE' ${userScope}
     GROUP BY cs.case_stage`,
    params
  );

  // 3. Court breakdown
  const [courtRows] = await db.execute(
    `SELECT crt.name as court_name, COUNT(*) as count
     FROM cases cs
     JOIN courts crt ON cs.court_id = crt.id
     WHERE cs.deleted_at IS NULL AND cs.case_status = 'ACTIVE' ${userScope}
     GROUP BY crt.name
     ORDER BY count DESC LIMIT 8`,
    params
  );

  // 4. Today's hearings count
  const [todayRows] = await db.execute(
    `SELECT COUNT(*) as count
     FROM case_hearings ch
     JOIN cases cs ON ch.case_id = cs.id
     WHERE cs.deleted_at IS NULL AND ch.hearing_date = CURDATE() AND ch.status = 'SCHEDULED' ${userScope}`,
    params
  );

  // 5. Tomorrow's hearings count
  const [tomorrowRows] = await db.execute(
    `SELECT COUNT(*) as count
     FROM case_hearings ch
     JOIN cases cs ON ch.case_id = cs.id
     WHERE cs.deleted_at IS NULL AND ch.hearing_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND ch.status = 'SCHEDULED' ${userScope}`,
    params
  );

  // 6. Upcoming hearings (next 7 days)
  const [upcomingRows] = await db.execute(
    `SELECT COUNT(*) as count
     FROM case_hearings ch
     JOIN cases cs ON ch.case_id = cs.id
     WHERE cs.deleted_at IS NULL AND ch.hearing_date > CURDATE() AND ch.hearing_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND ch.status = 'SCHEDULED' ${userScope}`,
    params
  );

  // 7. Active cases without upcoming hearing
  const [noHearingRows] = await db.execute(
    `SELECT COUNT(*) as count
     FROM cases cs
     WHERE cs.deleted_at IS NULL AND cs.case_status = 'ACTIVE' AND (cs.next_hearing_date IS NULL OR cs.next_hearing_date < CURDATE()) ${userScope}`,
    params
  );

  return {
    metrics: {
      totalCases,
      activeCases: statusMap.ACTIVE,
      stayedCases: statusMap.STAYED,
      disposedCases: statusMap.DISPOSED + statusMap.CLOSED,
      todayHearings: todayRows[0]?.count || 0,
      tomorrowHearings: tomorrowRows[0]?.count || 0,
      upcomingWeekHearings: upcomingRows[0]?.count || 0,
      casesWithoutUpcomingHearing: noHearingRows[0]?.count || 0,
    },
    byStatus: statusMap,
    byStage: stageRows.map((s) => ({ stage: s.case_stage, count: s.count })),
    byCourt: courtRows.map((c) => ({ court: c.court_name, count: c.count })),
  };
};

module.exports = {
  getCaseDashboardStats,
};
