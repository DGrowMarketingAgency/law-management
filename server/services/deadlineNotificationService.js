/**
 * Deadline Notification Service
 * Abstraction layer for limitation alert deliveries.
 * For Prompt 6, dispatches internal chamber alerts and provides hooks for future external channels.
 */

const sendDeadlineAlert = async ({
  deadlineId,
  alertType,
  scheduledFor,
  recipientId = null,
  effectiveDeadline,
  caseId = null,
  caseNumber = "N/A",
  caseTitle = "N/A",
  deadlineTitle = "Limitation Deadline",
}) => {
  const alertSummary = `[CHAMBERS ALERT - ${alertType}]: Deadline "${deadlineTitle}" for Case ${caseNumber} (${caseTitle}) is effective on ${effectiveDeadline}. Scheduled for: ${scheduledFor}.`;

  // Log internal dispatch
  console.log(`[DEADLINE ALERT DISPATCH]: ${alertSummary}`);

  // Return success result
  return {
    success: true,
    channel: "INTERNAL",
    recipientId,
    deliveredAt: new Date(),
    summary: alertSummary,
  };
};

module.exports = {
  sendDeadlineAlert,
};
