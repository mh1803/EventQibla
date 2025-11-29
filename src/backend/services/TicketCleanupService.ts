import db from "../db/connection.js";

export class TicketCleanupService {
  async cleanupCancelledTickets(): Promise<void> {
    try {
      await db.query("BEGIN");

      // Get tickets cancelled >7 days ago
      const oldCancelledTickets = await db.query(
        `SELECT id FROM tickets 
         WHERE status = 'cancelled' 
         AND updated_at < NOW() - INTERVAL '7 days'`
      );

      if (oldCancelledTickets.rows.length === 0) {
        await db.query("COMMIT");
        return;
      }

      const ticketIds = oldCancelledTickets.rows.map((t) => t.id);

      // Delete the tickets
      await db.query(
        `DELETE FROM tickets 
         WHERE id = ANY($1::int[])`,
        [ticketIds]
      );

      await db.query("COMMIT");
      console.log(
        `Deleted ${oldCancelledTickets.rows.length} cancelled tickets`
      );
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Error cleaning up cancelled tickets:", error);
      throw error;
    }
  }
}
