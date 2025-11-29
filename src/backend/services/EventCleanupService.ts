import db from "../db/connection.js";

export class EventCleanupService {
  async cleanupCancelledEvents(): Promise<void> {
    try {
      await db.query("BEGIN");

      // Get events cancelled >7 days ago
      const oldCancelledEvents = await db.query(
        `SELECT id FROM events 
         WHERE status = 'cancelled' 
         AND updated_at < NOW() - INTERVAL '7 days'`
      );

      if (oldCancelledEvents.rows.length === 0) {
        await db.query("COMMIT");
        return;
      }

      const eventIds = oldCancelledEvents.rows.map((e) => e.id);

      // Delete dependent records in reverse order of foreign key dependencies

      // Delete event reports
      await db.query(
        `DELETE FROM event_reports 
         WHERE event_id = ANY($1::int[])`,
        [eventIds]
      );

      // Delete event categories
      await db.query(
        `DELETE FROM event_categories 
         WHERE event_id = ANY($1::int[])`,
        [eventIds]
      );

      // Delete event tickets
      await db.query(
        `DELETE FROM tickets 
         WHERE event_id = ANY($1::int[])`,
        [eventIds]
      );

      // Delete the event
      await db.query(
        `DELETE FROM events 
         WHERE id = ANY($1::int[])`,
        [eventIds]
      );

      await db.query("COMMIT");
      console.log(
        `Cleaned up ${oldCancelledEvents.rows.length} cancelled events`
      );
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Error cleaning up cancelled events:", error);
      throw error;
    }
  }
}
