import { EventCleanupService } from "../services/EventCleanupService.js";
import cron from "node-cron";

const eventCleanupService = new EventCleanupService();

// Run daily at 3 AM
export function setupEventCleanupCron() {
  cron.schedule("0 3 * * *", async () => {
    console.log("Running cancelled events cleanup...");
    try {
      await eventCleanupService.cleanupCancelledEvents();
    } catch (error) {
      console.error("Error in event cleanup cron job:", error);
    }
  });
}
