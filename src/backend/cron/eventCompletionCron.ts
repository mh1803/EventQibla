import { EventCompletionService } from "../services/EventCompletionService.js";
import cron from "node-cron";

const eventCompletionService = new EventCompletionService();

// Run every 15 minutes
export function setupEventCompletionCron() {
  cron.schedule("*/15 * * * *", async () => {
    console.log("Running event completion check...");
    try {
      await eventCompletionService.completePastEvents();
    } catch (error) {
      console.error("Error in event completion cron job:", error);
    }
  });
}
