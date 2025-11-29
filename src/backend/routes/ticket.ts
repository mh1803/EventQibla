import { Router, Request, Response } from "express";
import db from "../db/connection.js";
import authenticateJWT from "../middleware/authenticateJWT.js";
import { verifyTicketOwnership } from "../utils/verifyTicketOwnership.js";
import { NotificationService } from "../services/NotificationService.js";

const router: Router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

// GET all tickets
router.get(
  "/my-tickets",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const statusFilter = (req.query.status as string) || "active";

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      let query = `
        SELECT t.id, t.ticket_code, t.status, t.price,
               e.title as event_title, e.start_time,
               e.end_time, e.image_url, e.id as event_id, 
               e.organiser_id as organiser_id,  
               CONCAT(e.address, ', ', e.city, ', ', e.post_code) as location
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.user_id = $1
      `;

      const params: any[] = [userId];

      if (["active", "cancelled", "completed"].includes(statusFilter)) {
        query += ` AND t.status = $${params.length + 1}`;
        params.push(statusFilter);
      }

      if (statusFilter === "completed") {
        query += `
          ORDER BY e.start_time DESC
          LIMIT 12
        `;
      } else {
        query += `
          ORDER BY e.start_time DESC
        `;
      }

      const result = await db.query(query, params);

      res.status(200).json(
        result.rows.map((ticket) => ({
          id: ticket.id,
          eventTitle: ticket.event_title,
          ticketCode: ticket.ticket_code,
          status: ticket.status,
          price: parseFloat(ticket.price),
          startTime: ticket.start_time,
          endTime: ticket.end_time,
          location: ticket.location,
          imageUrl: ticket.image_url,
          eventId: ticket.event_id,
          organiserId: ticket.organiser_id,
        }))
      );
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.delete(
  "/:ticketCode/cancel",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    const transaction = await db.connect();
    try {
      const userId = req.user?.id;
      const { ticketCode } = req.params;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      await transaction.query("BEGIN");

      // Verify ticket ownership and get event details
      const ticket = await transaction.query(
        `SELECT t.*, e.title, e.price, e.start_time, e.end_time, e.id as event_id, 
         e.capacity, 
         (SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status IN ('active', 'completed')) as current_attendance
         FROM tickets t
         JOIN events e ON t.event_id = e.id
         WHERE t.ticket_code = $1 AND t.user_id = $2
         FOR UPDATE`,
        [ticketCode, userId]
      );

      if (ticket.rows.length === 0) {
        await transaction.query("ROLLBACK");
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const ticketData = ticket.rows[0];

      // Validate ticket state
      if (ticketData.status === "cancelled") {
        await transaction.query("ROLLBACK");
        res.status(400).json({ message: "Ticket already cancelled" });
        return;
      }

      if (ticketData.status === "complete") {
        await transaction.query("ROLLBACK");
        res.status(400).json({ message: "Event already completed" });
        return;
      }

      // Check if event starts within 5 minutes
      const FIVE_MINUTES = 5 * 60 * 1000;
      const startTime = new Date(ticketData.start_time);
      const now = new Date();

      if (startTime.getTime() - now.getTime() < FIVE_MINUTES) {
        await transaction.query("ROLLBACK");
        res.status(400).json({
          message: "Cannot cancel ticket within 5 minutes of event start",
          startTime: ticketData.start_time,
          currentTime: now.toISOString(),
        });
        return;
      }

      // Update ticket status and updated_at timestamp
      await transaction.query(
        `UPDATE tickets 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE ticket_code = $1`,
        [ticketCode]
      );

      // Create cancellation notification
      const notificationService = new NotificationService(transaction);
      await notificationService.createNotification({
        userId: userId,
        title: `Ticket Cancelled: ${ticketData.title}`,
        content: `Your ticket for "${ticketData.title}" has been cancelled.${
          ticketData.price > 0 ? " You will be refunded shortly." : ""
        }`,
        entityType: "ticket",
        entityId: ticketData.id,
      });

      // Notify all waitlisted users
      const waitlistUsers = await transaction.query(
        `SELECT user_id FROM event_waitlist 
         WHERE event_id = $1`,
        [ticketData.event_id]
      );

      for (const user of waitlistUsers.rows) {
        await notificationService.createNotification({
          userId: user.user_id,
          title: "Ticket Available!",
          content: `A spot has opened up for "${ticketData.title}". Book now before it's gone!`,
          entityType: "event",
          entityId: ticketData.event_id,
        });
      }

      await transaction.query("COMMIT");

      res.status(200).json({
        success: true,
        ticketCode,
        eventTitle: ticketData.title,
        notifiedUsers: waitlistUsers.rowCount,
        wasEventFull: ticketData.current_attendance >= ticketData.capacity,
        spotsNowAvailable: ticketData.current_attendance - 1,
      });
    } catch (error) {
      await transaction.query("ROLLBACK");
      console.error("Cancellation error:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      transaction.release();
    }
  }
);

// Get single ticket by code
router.get(
  "/:ticketCode",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { ticketCode } = req.params;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const ticket = await verifyTicketOwnership(userId, ticketCode);
      if (!ticket) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      res.status(200).json({
        id: ticket.id,
        eventTitle: ticket.event_title,
        ticketCode: ticket.ticket_code,
        status: ticket.status,
        price: parseFloat(ticket.price),
        startTime: ticket.start_time,
        endTime: ticket.end_time,
        location: `${ticket.address}, ${ticket.city}, ${ticket.post_code}`,
        imageUrl: ticket.image_url,
      });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post(
  "/:ticketCode/scan",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    const { ticketCode } = req.params;
    const { eventId } = req.body;
    const userId = req.user?.id;

    // Input validation
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!eventId) {
      res.status(400).json({ message: "Event ID is required" });
      return;
    }

    const transaction = await db.connect();
    try {
      await transaction.query("BEGIN");

      const ticketQuery = await transaction.query(
        `SELECT 
          t.*, 
          e.title as event_title, 
          e.status as event_status,
          u.full_name as attendee_name, 
          u.email as attendee_email,
          CASE 
            WHEN t.status = 'completed' THEN 'already_checked_in'
            WHEN t.status = 'cancelled' THEN 'cancelled'
            ELSE t.status
          END as validation_status
         FROM tickets t
         JOIN events e ON t.event_id = e.id
         JOIN users u ON t.user_id = u.id
         WHERE t.ticket_code = $1 AND t.event_id = $2
         FOR UPDATE`,
        [ticketCode, eventId]
      );

      if (ticketQuery.rows.length === 0) {
        await transaction.query("ROLLBACK");
        res.status(404).json({
          valid: false,
          code: "ticket_not_found",
          message: "Ticket not found for this event",
        });
        return;
      }

      const ticket = ticketQuery.rows[0];

      switch (ticket.validation_status) {
        case "already_checked_in":
          await transaction.query("ROLLBACK");
          res.status(409).json({
            valid: false,
            code: "already_checked_in",
            message: "This ticket has already been scanned",
            details: {
              attendee: ticket.attendee_name,
              event: ticket.event_title,
            },
          });
          return;

        case "cancelled":
          await transaction.query("ROLLBACK");
          res.status(410).json({
            valid: false,
            code: "ticket_cancelled",
            message: "This ticket has been cancelled",
            details: {
              attendee: ticket.attendee_name,
              event: ticket.event_title,
            },
          });
          return;

        case "active":
          break;

        default:
          await transaction.query("ROLLBACK");
          res.status(400).json({
            valid: false,
            code: "invalid_ticket_status",
            message: `Ticket status is invalid: ${ticket.status}`,
          });
          return;
      }

      if (ticket.event_status !== "active") {
        await transaction.query("ROLLBACK");
        res.status(400).json({
          valid: false,
          code: "event_not_active",
          message: `Event is ${ticket.event_status}`,
          eventTitle: ticket.event_title,
        });
        return;
      }

      // Update ticket status and updated_at timestamp
      await transaction.query(
        `UPDATE tickets 
         SET status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE ticket_code = $1`,
        [ticketCode]
      );

      await transaction.query("COMMIT");

      res.json({
        valid: true,
        code: "check_in_success",
        attendee: {
          id: ticket.user_id,
          fullName: ticket.attendee_name,
          email: ticket.attendee_email,
          ticketId: ticket.id,
        },
        event: {
          id: ticket.event_id,
          title: ticket.event_title,
        },
        checkInTime: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.query("ROLLBACK");
      console.error("Check-in error:", error);
      res.status(500).json({
        code: "internal_server_error",
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      transaction.release();
    }
  }
);

router.delete(
  "/:ticketCode/remove-attendee",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    let transaction;
    try {
      const userId = req.user?.id;
      const { ticketCode } = req.params;
      const { removalReason } = req.body;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      if (!removalReason?.trim()) {
        res.status(400).json({ message: "Removal reason is required" });
        return;
      }

      transaction = await db.connect();
      await transaction.query("BEGIN");

      // Verify ticket exists and user is the organiser of the event
      const ticketQuery = await transaction.query(
        `SELECT t.*, e.organiser_id as organiser_id, e.start_time, e.title as event_title,
                e.id as event_id, e.capacity,
                u.id as attendee_id, u.email as attendee_email, u.full_name as attendee_name,
                (SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status IN ('active', 'completed')) as current_attendance
         FROM tickets t
         JOIN events e ON t.event_id = e.id
         JOIN users u ON t.user_id = u.id
         WHERE t.ticket_code = $1
         FOR UPDATE`,
        [ticketCode]
      );

      if (ticketQuery.rows.length === 0) {
        await transaction.query("ROLLBACK");
        res.status(404).json({ message: "Ticket not found" });
        return;
      }

      const ticket = ticketQuery.rows[0];

      // Check if user is the organiser
      if (ticket.organiser_id !== userId) {
        await transaction.query("ROLLBACK");
        res.status(403).json({
          message: "Only the event organiser can remove attendees",
        });
        return;
      }

      // Check if event has already started
      if (new Date(ticket.start_time) <= new Date()) {
        await transaction.query("ROLLBACK");
        res.status(400).json({
          message: "Cannot remove attendee after event has started",
        });
        return;
      }

      // Check if ticket is already cancelled or has no attendee
      if (ticket.status === "cancelled" || !ticket.attendee_id) {
        await transaction.query("ROLLBACK");
        res.status(400).json({
          message: "Ticket is already cancelled or has no attendee",
        });
        return;
      }

      // Mark Ticket as cancelled and update timestamp
      await transaction.query(
        `UPDATE tickets 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE ticket_code = $1`,
        [ticketCode]
      );

      // Refund message
      const refundInitiated = ticket.price > 0;

      // Send notification to the removed attendee
      const notificationService = new NotificationService(transaction);
      await notificationService.createNotification({
        userId: ticket.attendee_id,
        title: `Removed from event: ${ticket.event_title}`,
        content: `Hi ${
          ticket.attendee_name
        }, you've been removed from the event "${ticket.event_title}". 
                 ${
                   refundInitiated
                     ? `You will be refunded ${ticket.price}.`
                     : ""
                 }
                 Reason: ${removalReason}`,
        entityType: "ticket",
        entityId: ticket.id,
      });

      // Notify all waitlisted users
      const waitlistUsers = await transaction.query(
        `SELECT user_id FROM event_waitlist 
         WHERE event_id = $1`,
        [ticket.event_id]
      );

      for (const user of waitlistUsers.rows) {
        await notificationService.createNotification({
          userId: user.user_id,
          title: "Ticket Available!",
          content: `A spot has opened up for "${ticket.event_title}". Book now before it's gone!`,
          entityType: "event",
          entityId: ticket.event_id,
        });
      }

      await transaction.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Attendee removed successfully",
        ticketCode,
        refundInitiated,
        notificationSent: true,
        waitlistNotified: waitlistUsers.rowCount,
        spotsAvailable: ticket.capacity - (ticket.current_attendance - 1),
      });
    } catch (error) {
      if (transaction) {
        await transaction.query("ROLLBACK").catch((rollbackError) => {
          console.error("Failed to rollback transaction:", rollbackError);
        });
      }
      console.error("Error removing attendee:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      if (transaction) {
        try {
          await transaction.release();
        } catch (releaseError) {
          console.error("Failed to release transaction:", releaseError);
        }
      }
    }
  }
);

export default router;
