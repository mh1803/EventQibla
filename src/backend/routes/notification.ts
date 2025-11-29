import { Router, Request, Response } from "express";
import { NotificationService } from "../services/NotificationService.js";
import authenticateJWT from "../middleware/authenticateJWT.js";

const router: Router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

// GET Authenticated User's Notifications
router.get("/", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized: User ID missing" });
      return;
    }

    // Display Last 20
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notificationService = new NotificationService();

    // Fetch notifications
    const notifications = await notificationService.getUserNotifications(
      userId,
      limit,
      offset
    );

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      message: "Failed to fetch notifications",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET count of authenticated user's unread notifications
router.get(
  "/unread/count",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: User ID missing" });
        return;
      }

      const notificationService = new NotificationService();

      // Fetch the count of unread notifications
      const count = await notificationService.getUnreadCount(userId);

      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({
        message: "Failed to get unread count",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Marks retrieved notifications as read
router.patch(
  "/read-all",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: User ID missing" });
        return;
      }

      const notificationService = new NotificationService();
      await notificationService.markAllAsRead(userId);

      res.status(204).end();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({
        message: "Failed to mark all notifications as read",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
