import db from "../db/connection.js";
import { NotificationService } from "./NotificationService.js";

export class EventCompletionService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async completePastEvents(): Promise<void> {
    try {
      await db.query("BEGIN");

      // Get all active events that have ended
      const pastEvents = await db.query(
        `SELECT id, title FROM events 
         WHERE status = 'active' AND end_time < NOW()`
      );

      if (pastEvents.rows.length === 0) {
        await db.query("COMMIT");
        return;
      }

      const eventIds = pastEvents.rows.map((e) => e.id);

      // Update events to completed status
      await db.query(
        `UPDATE events 
         SET status = 'completed', updated_at = NOW()
         WHERE id = ANY($1::int[])`,
        [eventIds]
      );

      // Update all related active tickets to completed status
      await db.query(
        `UPDATE tickets 
         SET status = 'completed'
         WHERE event_id = ANY($1::int[]) AND status = 'active'`,
        [eventIds]
      );

      // Send notifications to attendees for each completed event
      for (const event of pastEvents.rows) {
        await this.notifyEventAttendees(event.id, event.title);
      }

      await db.query("COMMIT");
      console.log(`Marked ${pastEvents.rows.length} past events as completed`);
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Error completing past events:", error);
      throw error;
    }
  }

  private async notifyEventAttendees(
    eventId: number,
    eventTitle: string
  ): Promise<void> {
    try {
      // Get all unique attendees who completed the event
      const attendees = await db.query(
        `SELECT DISTINCT user_id FROM tickets 
         WHERE event_id = $1 AND status = 'completed'`,
        [eventId]
      );

      if (attendees.rows.length === 0) return;

      for (const attendee of attendees.rows) {
        await this.notificationService.createNotification({
          userId: attendee.user_id,
          title: `Thanks for attending ${eventTitle}!`,
          content: `We hope you enjoyed ${eventTitle}! Please leave a review and share your experience on social media.`,
          entityType: "event",
          entityId: eventId,
        });
      }

      console.log(
        `Sent post-event notifications to ${attendees.rows.length} attendees for event ${eventId}`
      );
    } catch (error) {
      console.error(`Error notifying attendees for event ${eventId}:`, error);
    }
  }
}
