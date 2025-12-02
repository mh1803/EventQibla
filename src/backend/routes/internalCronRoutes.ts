import { Router, Request, Response, NextFunction } from "express";
import { EventCleanupService } from "../services/EventCleanupService.js";
import { EventCompletionService } from "../services/EventCompletionService.js";
import { EventReminderService } from "../services/EventReminderService.js";
import { TicketCleanupService } from "../services/TicketCleanupService.js";

const router = Router();

const eventCleanupService = new EventCleanupService();
const eventCompletionService = new EventCompletionService();
const eventReminderService = new EventReminderService();
const ticketCleanupService = new TicketCleanupService();

const CRON_SECRET = process.env.CRON_SECRET;

// Helper to log request + response
const logCron = (route: string, result: any) => {
  console.log(`CRON TRIGGERED: ${route}`);
  console.log(`Response:`, result);
};

router.post(
  "/cleanup-events",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.headers["x-cron-secret"] !== CRON_SECRET) {
        const result = { error: "Unauthorized" };
        logCron("cleanup-events", result);
        res.status(401).json(result);
        return;
      }

      const result = await eventCleanupService.cleanupCancelledEvents();
      const response = { status: "ok", result };
      logCron("cleanup-events", response);

      res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/complete-events",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.headers["x-cron-secret"] !== CRON_SECRET) {
        const result = { error: "Unauthorized" };
        logCron("complete-events", result);
        res.status(401).json(result);
        return;
      }

      const result = await eventCompletionService.completePastEvents();
      const response = { status: "ok", result };
      logCron("complete-events", response);

      res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/send-reminders",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.headers["x-cron-secret"] !== CRON_SECRET) {
        const result = { error: "Unauthorized" };
        logCron("send-reminders", result);
        res.status(401).json(result);
        return;
      }

      const result = await eventReminderService.sendEventReminders();
      const response = { status: "ok", result };
      logCron("send-reminders", response);

      res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/cleanup-tickets",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.headers["x-cron-secret"] !== CRON_SECRET) {
        const result = { error: "Unauthorized" };
        logCron("cleanup-tickets", result);
        res.status(401).json(result);
        return;
      }

      const result = await ticketCleanupService.cleanupCancelledTickets();
      const response = { status: "ok", result };
      logCron("cleanup-tickets", response);

      res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
