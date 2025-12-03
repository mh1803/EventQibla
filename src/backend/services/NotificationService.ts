import db from "../db/connection.js";
import {
  Notification,
  CreateNotificationParams,
} from "../types/notificationTypes";

export class NotificationService {
  private client?: any;

  constructor(client?: any) {
    this.client = client;
  }

  async createNotification({
    userId,
    title,
    content,
    entityType,
    entityId,
  }: CreateNotificationParams): Promise<Notification> {
    const query = `
      INSERT INTO notifications 
      (user_id, title, content, related_entity_type, related_entity_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;

    const values = [userId, title, content, entityType, entityId];

    try {
      // Use transaction client if available, otherwise uses default db connection
      const executor = this.client || db;
      const result = await executor.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error("Error creating notification:", error);
      throw new Error("Failed to create notification");
    }
  }

  // Fetches a paginated list of notifications for a given user
  async getUserNotifications(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    try {
      const executor = this.client || db;
      const result = await executor.query(query, [userId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw new Error("Failed to fetch notifications");
    }
  }

  // Marks all unread notifications as read for a given user
  async markAllAsRead(userId: number): Promise<void> {
    const query = `
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE user_id = $1 AND is_read = FALSE
    `;

    try {
      const executor = this.client || db;
      await executor.query(query, [userId]);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw new Error("Failed to mark all notifications as read");
    }
  }

  // Retrieves unread notification count for a given user
  async getUnreadCount(userId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM notifications 
      WHERE user_id = $1 AND is_read = FALSE
    `;

    try {
      const executor = this.client || db;
      const result = await executor.query(query, [userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw new Error("Failed to get unread notification count");
    }
  }
}
