import { Router, Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./auth.js";
import eventRoutes from "./event.js";
import ticketRoutes from "./ticket.js";
import userRoutes from "./user.js";
import notificationRoutes from "./notification.js";
import adminRoutes from "./admin.js";

const router: Router = Router();

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const indexPath: string = path.resolve(
      __dirname,
      "../../frontend/index.html"
    );
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error("Error sending index.html:", err);
        if (!res.headersSent) {
          res.status(500).send("An error occurred while serving the page.");
        }
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    if (!res.headersSent) {
      res.status(500).send("Server error occurred.");
    }
  }
});

router.use("/auth", authRoutes);
router.use("/event", eventRoutes);
router.use("/ticket", ticketRoutes);
router.use("/user", userRoutes);
router.use("/notification", notificationRoutes);
router.use("/admin", adminRoutes);
export default router;
