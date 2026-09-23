const hearingReminderService = require("./hearingReminderService");

/**
 * Backend Hearing Reminder Scheduler
 * Runs periodically to process due hearing reminders.
 * Fully decoupled from frontend state. Persists all progress in MySQL.
 */
class HearingReminderScheduler {
  constructor() {
    this.intervalHandle = null;
    this.isRunning = false;
    this.intervalMs = 60 * 1000; // Check every 60 seconds
  }

  start() {
    if (this.intervalHandle) {
      return;
    }

    console.log("[HearingReminderScheduler] Started background reminder processor (Interval: 60s)");

    // Run an initial tick shortly after startup
    setTimeout(() => {
      this.tick();
    }, 5000);

    this.intervalHandle = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  async tick() {
    if (this.isRunning) {
      return; // Previous run still active
    }

    // Strict Production Safety: Automatic reminders MUST NOT run in test mode
    if (process.env.AISENSY_ENABLED !== "true" || process.env.AISENSY_TEST_MODE === "true") {
      return;
    }

    this.isRunning = true;
    try {
      const result = await hearingReminderService.processDueReminders();
      if (result.processed > 0) {
        console.log(`[HearingReminderScheduler] Processed ${result.processed} due reminder(s).`);
      }
    } catch (err) {
      console.error("[HearingReminderScheduler Error]:", err.message);
    } finally {
      this.isRunning = false;
    }
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("[HearingReminderScheduler] Stopped.");
    }
  }
}

module.exports = new HearingReminderScheduler();
