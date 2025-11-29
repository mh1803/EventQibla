import { EventReminderService } from "../services/EventReminderService.js";
import cron from "node-cron";

const eventReminderService = new EventReminderService();

// Run every hour at the 0 minute mark
export function setupEventReminderCron() {
  cron.schedule("0 * * * *", async () => {
    console.log("Running event reminder check...");
    try {
      // Send 24h and 1h reminders
      await eventReminderService.sendEventReminders();
    } catch (error) {
      console.error("Error in event reminder cron job:", error);
    }
  });
}
