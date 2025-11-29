import db from "../db/connection.js";
import { NotificationService } from "./NotificationService.js";
import { DateTime } from "luxon";

export class EventReminderService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // Get all events that are starting within the next 24 hours
  private async getUpcomingEvents(): Promise<any[]> {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const query = `
      SELECT e.id, e.title, e.start_time, e.image_url, e.organiser_id
      FROM events e
      WHERE e.status = 'active'
      AND e.start_time BETWEEN $1 AND $2
    `;

    try {
      const result = await db.query(query, [now, twentyFourHoursLater]);
      return result.rows;
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      throw new Error("Failed to fetch upcoming events");
    }
  }

  // Get all distinct users attending an event besides organiser
  private async getEventAttendees(
    eventId: number,
    organizerId: number
  ): Promise<number[]> {
    const query = `
      SELECT DISTINCT user_id FROM tickets 
      WHERE event_id = $1 AND status = 'active' AND user_id != $2
    `;

    try {
      const result = await db.query(query, [eventId, organizerId]);
      return result.rows.map((row) => row.user_id);
    } catch (error) {
      console.error("Error fetching event attendees:", error);
      throw new Error("Failed to fetch event attendees");
    }
  }

  // Send reminders for all upcoming events at 24h and 1h before
  public async sendEventReminders(): Promise<void> {
    try {
      const upcomingEvents = await this.getUpcomingEvents();

      for (const event of upcomingEvents) {
        const attendees = await this.getEventAttendees(
          event.id,
          event.organiser_id
        );
        const eventTime = DateTime.fromJSDate(event.start_time);
        const hoursUntilEvent = eventTime.diffNow().as("hours");

        const recipients = new Set<number>(attendees);

        recipients.add(event.organiser_id);

        if (Math.abs(hoursUntilEvent - 24) < 1) {
          // 24-hour reminder
          await this.sendReminders(
            Array.from(recipients),
            event.id,
            event.title,
            "24 hours",
            `Your event "${event.title}" is coming up tomorrow!`,
            event.organiser_id
          );
        } else if (Math.abs(hoursUntilEvent - 1) < 1) {
          // 1-hour reminder
          await this.sendReminders(
            Array.from(recipients),
            event.id,
            event.title,
            "1 hour",
            `Your event "${event.title}" starts in 1 hour! Don't forget!`,
            event.organiser_id
          );
        }
      }
    } catch (error) {
      console.error("Error in sendEventReminders:", error);
      throw new Error("Failed to send event reminders");
    }
  }

  // Helper method to send notifications to all recipients
  private async sendReminders(
    recipientIds: number[],
    eventId: number,
    eventTitle: string,
    reminderTime: string,
    content: string,
    organizerId: number
  ): Promise<void> {
    const totalRecipients = recipientIds.length;
    const isOrganizerIncluded = recipientIds.includes(organizerId);
    const attendeeCount = isOrganizerIncluded
      ? totalRecipients - 1
      : totalRecipients;

    for (const userId of recipientIds) {
      await this.notificationService.createNotification({
        userId,
        title: `Event Reminder (${reminderTime}): ${eventTitle}`,
        content: content,
        entityType: "event",
        entityId: eventId,
      });
    }

    console.log(
      `Sent ${reminderTime} reminders for event ${eventId} to ${totalRecipients} recipients ` +
        `(${attendeeCount} attendees and ${
          isOrganizerIncluded ? 1 : 0
        } organizer)`
    );
  }
}
