import { Router, Request, Response, NextFunction } from "express";
import authenticateJWT from "../middleware/authenticateJWT.js";
import db from "../db/connection.js";

const router: Router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

// Flag an event
router.post(
  "/:id",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id: eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized: User ID missing" });
      return;
    }

    try {
      const event = await db.query("SELECT * FROM events WHERE id = $1", [
        eventId,
      ]);
      if (event.rows.length === 0) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      const existingFlag = await db.query(
        "SELECT * FROM event_reports WHERE event_id = $1 AND user_id = $2",
        [eventId, userId]
      );

      if (existingFlag.rows.length > 0) {
        res
          .status(400)
          .json({ message: "You have already flagged this event" });
        return;
      }

      await db.query("BEGIN");

      // Update flagged_count and last_flagged_at
      await db.query(
        `UPDATE events 
         SET flagged_count = flagged_count + 1, 
             last_flagged_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [eventId]
      );

      await db.query(
        "INSERT INTO event_reports (event_id, user_id) VALUES ($1, $2)",
        [eventId, userId]
      );

      await db.query("COMMIT");

      res.status(200).json({
        message: "Event flagged successfully",
        flaggedCount: event.rows[0].flagged_count + 1,
        lastFlaggedAt: new Date().toISOString(),
      });
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Error flagging event:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Check if event is flagged by the user
router.get(
  "/:id/check-flag",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id: eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized: User ID missing" });
      return;
    }

    try {
      const existingFlag = await db.query(
        "SELECT * FROM event_reports WHERE event_id = $1 AND user_id = $2",
        [eventId, userId]
      );

      res.status(200).json({ isFlagged: existingFlag.rows.length > 0 });
    } catch (error) {
      console.error("Error checking flag status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
