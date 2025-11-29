import { Router, Request, Response, NextFunction } from "express";
import db from "../db/connection.js";
import authenticateJWT from "../middleware/authenticateJWT.js";
import { NotificationService } from "../services/NotificationService.js";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

// Admin middleware
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req?.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};

// GET all users
router.get(
  "/users",
  authenticateJWT,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        sort = "newest",
        search = "",
        page = "1",
        limit = "20",
      } = req.query as {
        sort?: "newest" | "oldest" | "rating_asc" | "rating_desc";
        search?: string;
        page?: string;
        limit?: string;
      };

      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 20;
      const offset = (pageNumber - 1) * limitNumber;

      let baseQuery = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.role,
          u.created_at,
          COALESCE(AVG(r.rating), 0) as avg_rating,
          COUNT(r.id) as review_count
        FROM users u
        LEFT JOIN reviews r ON r.reviewed_user_id = u.id
      `;

      // Count query
      let countQuery = `SELECT COUNT(*) as total FROM users u`;
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        baseQuery += ` WHERE u.username ILIKE $${paramCount} OR u.email ILIKE $${paramCount}`;
        countQuery += ` WHERE u.username ILIKE $1 OR u.email ILIKE $1`;
        params.push(`%${search}%`);
      }

      baseQuery += ` GROUP BY u.id`;

      // Sorting
      switch (sort) {
        case "rating_asc":
          baseQuery += ` ORDER BY avg_rating ASC`;
          break;
        case "rating_desc":
          baseQuery += ` ORDER BY avg_rating DESC`;
          break;
        case "oldest":
          baseQuery += ` ORDER BY u.created_at ASC`;
          break;
        default:
          baseQuery += ` ORDER BY u.created_at DESC`;
      }

      // Pagination
      paramCount++;
      baseQuery += ` LIMIT $${paramCount}`;
      params.push(limitNumber);

      paramCount++;
      baseQuery += ` OFFSET $${paramCount}`;
      params.push(offset);

      // Execute queries in parallel
      const [usersResult, countResult] = await Promise.all([
        db.query(baseQuery, params),
        db.query(countQuery, search ? [params[0]] : []),
      ]);

      const totalUsers = parseInt(countResult.rows[0]?.total || "0", 10);
      const totalPages = Math.ceil(totalUsers / limitNumber);

      // Get event IDs for each user
      const usersWithEvents = await Promise.all(
        usersResult.rows.map(async (user) => {
          const events = await db.query(
            `SELECT id FROM events WHERE organiser_id = $1`,
            [user.id]
          );
          return {
            ...user,
            event_ids: events.rows.map((e) => e.id),
          };
        })
      );

      res.json({
        data: usersWithEvents,
        pagination: {
          currentPage: pageNumber,
          perPage: limitNumber,
          total: totalUsers,
          totalPages: totalPages,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// BAN USER
router.post(
  "/users/:id/ban",
  authenticateJWT,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await db.connect();
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: "Invalid user ID" });
        return;
      }

      await client.query("BEGIN");

      const user = await client.query(
        `SELECT id, username, role FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (user.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ message: "User not found" });
        return;
      }

      if (user.rows[0].role === "admin") {
        await client.query("ROLLBACK");
        res.status(403).json({ message: "Admins cannot be banned" });
        return;
      }

      // Get all active events organized by this user
      const events = await client.query(
        `SELECT id, title FROM events 
         WHERE organiser_id = $1 AND status = 'active'`,
        [userId]
      );

      // Ban the user
      await client.query(`UPDATE users SET role = 'banned' WHERE id = $1`, [
        userId,
      ]);

      let cancelledEvents = 0;
      if (events.rows.length > 0) {
        await client.query(
          `UPDATE events SET status = 'cancelled' 
           WHERE organiser_id = $1 AND status = 'active'`,
          [userId]
        );

        const notifyService = new NotificationService(client);
        for (const event of events.rows) {
          const ticketHolders = await client.query(
            `SELECT DISTINCT user_id FROM tickets 
             WHERE event_id = $1 AND status = 'active'`,
            [event.id]
          );

          await Promise.all(
            ticketHolders.rows.map((holder) =>
              notifyService.createNotification({
                userId: holder.user_id,
                title: "Event Cancelled",
                content: `Event "${event.title}" was cancelled due to organiser ban`,
                entityType: "event",
                entityId: event.id,
              })
            )
          );
          cancelledEvents++;
        }
      }

      // Handle the banned user's tickets
      const cancelledTickets = await client.query(
        `UPDATE tickets SET status = 'cancelled'
         WHERE user_id = $1 AND status = 'active'
         RETURNING event_id`,
        [userId]
      );

      // Notify waitlist for all events where tickets were cancelled
      const notificationService = new NotificationService(client);
      const notifiedEvents = new Set<number>();

      for (const ticket of cancelledTickets.rows) {
        if (notifiedEvents.has(ticket.event_id)) continue;

        notifiedEvents.add(ticket.event_id);

        // Get event details
        const event = await client.query(
          `SELECT id, title FROM events WHERE id = $1`,
          [ticket.event_id]
        );

        if (event.rows.length === 0) continue;

        // Notify all waitlisted users
        const waitlistUsers = await client.query(
          `SELECT user_id FROM event_waitlist 
           WHERE event_id = $1`,
          [ticket.event_id]
        );

        for (const user of waitlistUsers.rows) {
          await notificationService.createNotification({
            userId: user.user_id,
            title: "Ticket Available!",
            content: `A spot has opened up for "${event.rows[0].title}". Book now before it's gone!)`,
            entityType: "event",
            entityId: ticket.event_id,
          });
        }
      }

      await client.query("COMMIT");
      res.json({
        success: true,
        banned_user_id: userId,
        cancelled_events: cancelledEvents,
        cancelled_tickets: cancelledTickets.rowCount,
        notified_waitlist_users: notifiedEvents.size,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

// UNBAN USER
router.post(
  "/users/:id/unban",
  authenticateJWT,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: "Invalid user ID" });
        return;
      }

      const result = await db.query(
        `UPDATE users SET role = 'user' 
         WHERE id = $1 AND role = 'banned' 
         RETURNING id, username`,
        [userId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({
          message: "User not found or already unbanned",
        });
        return;
      }

      res.json({
        success: true,
        unbanned_user: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
