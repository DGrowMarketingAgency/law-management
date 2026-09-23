const db = require("../config/database");

/**
 * Aggregated CRM Dashboard Statistics via optimized SQL queries
 */
const getCRMDashboardStats = async (userId = null, isOwner = false) => {
  // 1. Total Contacts
  const [contactsCount] = await db.execute(
    `SELECT COUNT(*) as count FROM contacts WHERE deleted_at IS NULL`
  );

  // 2. Active Clients
  const [clientsCount] = await db.execute(
    `SELECT COUNT(*) as count FROM clients WHERE status = 'ACTIVE'`
  );

  // 3. Open Leads (Not RETAINED and not NOT_CONVERTED)
  const [openLeadsCount] = await db.execute(
    `SELECT COUNT(*) as count FROM leads WHERE status IN ('INQUIRY', 'CONSULTATION_SCHEDULED', 'CONSULTATION_DONE')`
  );

  // 4. Consultations Scheduled
  const [consultationsCount] = await db.execute(
    `SELECT COUNT(*) as count FROM leads WHERE status = 'CONSULTATION_SCHEDULED'`
  );

  // 5. Follow-ups (Pending & Overdue)
  const [pendingFollowUps] = await db.execute(
    `SELECT COUNT(*) as count FROM follow_ups WHERE status = 'PENDING'`
  );

  const [overdueFollowUps] = await db.execute(
    `SELECT COUNT(*) as count FROM follow_ups WHERE status = 'PENDING' AND DATE(scheduled_for) < CURDATE()`
  );

  // 6. Today's Appointments
  const [todayAppointments] = await db.execute(
    `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURDATE() AND status = 'SCHEDULED'`
  );

  // 7. Upcoming Appointments (Next 7 days)
  const [upcomingAppointments] = await db.execute(
    `SELECT COUNT(*) as count 
     FROM appointments 
     WHERE appointment_date > CURDATE() AND appointment_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status = 'SCHEDULED'`
  );

  // Recent 5 Contacts
  const [recentContacts] = await db.execute(
    `SELECT id, display_name, email, phone, contact_type, created_at
     FROM contacts
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 5`
  );

  // Recent 5 Leads
  const [recentLeads] = await db.execute(
    `SELECT l.id, l.source, l.status, l.created_at, c.display_name as contact_name
     FROM leads l
     JOIN contacts c ON l.contact_id = c.id
     WHERE c.deleted_at IS NULL
     ORDER BY l.created_at DESC LIMIT 5`
  );

  // Today's Upcoming Appointments
  const [todayAptList] = await db.execute(
    `SELECT a.id, a.title, a.appointment_type, a.start_time, a.end_time, c.display_name as contact_name, u.first_name, u.last_name
     FROM appointments a
     LEFT JOIN contacts c ON a.contact_id = c.id
     JOIN users u ON a.assigned_to = u.id
     WHERE a.appointment_date = CURDATE() AND a.status = 'SCHEDULED'
     ORDER BY a.start_time ASC LIMIT 5`
  );

  return {
    metrics: {
      totalContacts: contactsCount[0]?.count || 0,
      activeClients: clientsCount[0]?.count || 0,
      openLeads: openLeadsCount[0]?.count || 0,
      consultationsScheduled: consultationsCount[0]?.count || 0,
      pendingFollowUps: pendingFollowUps[0]?.count || 0,
      overdueFollowUps: overdueFollowUps[0]?.count || 0,
      todayAppointments: todayAppointments[0]?.count || 0,
      upcomingAppointments: upcomingAppointments[0]?.count || 0,
    },
    recentContacts,
    recentLeads: recentLeads.map((l) => ({
      id: l.id,
      source: l.source,
      status: l.status,
      contactName: l.contact_name,
      createdAt: l.created_at,
    })),
    todayAppointments: todayAptList.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.appointment_type,
      startTime: a.start_time,
      endTime: a.end_time,
      contactName: a.contact_name,
      assignedTo: `${a.first_name} ${a.last_name}`,
    })),
  };
};

module.exports = {
  getCRMDashboardStats,
};
