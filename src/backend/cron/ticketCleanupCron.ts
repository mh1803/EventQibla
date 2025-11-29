import { TicketCleanupService } from "../services/TicketCleanupService.js";
import cron from "node-cron";

const ticketCleanupService = new TicketCleanupService();

// Run daily at 2 AM
export function setupTicketCleanupCron() {
  cron.schedule("0 2 * * *", async () => {
    console.log("Running cancelled tickets cleanup...");
    try {
      await ticketCleanupService.cleanupCancelledTickets();
    } catch (error) {
      console.error("Error in ticket cleanup cron job:", error);
    }
  });
}
