import { Router, Request, Response } from "express";
import { validationResult, body } from "express-validator";
import db from "../db/connection.js";
import authenticateJWT from "../middleware/authenticateJWT.js";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "../services/NotificationService.js";

const router: Router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]? \d[A-Z]{2}$/i;

const validateBookingInput = [
  body("pricePaid")
    .isFloat({ min: 0 })
    .withMessage("Price paid must be a non-negative number"),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("expiration_date")
    .if(body("pricePaid").exists().isFloat({ min: 0.01 }))
    .notEmpty()
    .withMessage("Expiration date is required for paid events")
    .matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
    .withMessage(
      "Expiration date must be in the format MM/YY and month must be 01-12"
    )
    .custom((value) => {
      const [month, year] = value.split("/");
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear() % 100;
      const currentMonth = currentDate.getMonth() + 1;

      const expMonth = parseInt(month, 10);
      const expYear = parseInt(year, 10);

      // Date validation
      if (expYear < currentYear) return false;
      if (expYear === currentYear && expMonth < currentMonth) return false;

      return true;
    })
    .withMessage("Card has expired or date is invalid"),
  body("cvc")
    .if(body("pricePaid").exists().isFloat({ min: 0.01 }))
    .notEmpty()
    .withMessage("CVC is required for paid events")
    .isLength({ min: 3, max: 4 })
    .withMessage("CVC must be 3 or 4 digits"),
  body("zip_code")
    .if(body("pricePaid").exists().isFloat({ min: 0.01 }))
    .notEmpty()
    .withMessage("Zip code is required for paid events")
    .custom((value) => ukPostcodeRegex.test(value))
    .withMessage("Invalid UK postal code. Example: A1 1AA or AA11AA"),
];

router.post(
  "/:id",
  authenticateJWT,
  validateBookingInput,
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json({ message: "Validation failed", errors: errors.array() });
        return;
      }

      const { id: eventId } = req.params;
      const { pricePaid, quantity, expiration_date, cvc, zip_code } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: User ID missing" });
        return;
      }

      const eventQuery = await db.query(
        "SELECT *, NOW() as current_time FROM events WHERE id = $1",
        [eventId]
      );
      const event = eventQuery.rows[0];

      if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      if (event.end_time < event.current_time) {
        res.status(400).json({
          message: "Event has already ended and cannot be booked",
          eventEndTime: event.end_time,
          currentTime: event.current_time,
        });
        return;
      }

      const ticketCountQuery = await db.query(
        "SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND status IN ('active', 'completed')",
        [eventId]
      );
      const ticketCount = parseInt(ticketCountQuery.rows[0].count, 10);

      if (ticketCount >= event.capacity) {
        res.status(400).json({ message: "Event is fully booked" });
        return;
      }

      if (ticketCount + quantity > event.capacity) {
        res.status(400).json({
          message: `Not enough tickets available. Only ${
            event.capacity - ticketCount
          } tickets left.`,
        });
        return;
      }

      // Calculate price per ticket
      const pricePerTicket =
        event.price > 0 ? pricePaid / quantity : event.price;

      if (event.price > 0) {
        const paymentSuccess = processPayment({
          cardNumber: req.body.bank_card,
          expirationDate: expiration_date,
          cvc: cvc,
          zipCode: zip_code,
          amount: event.price * quantity,
        });

        if (!paymentSuccess) {
          res.status(400).json({
            message: "Payment failed. Please check your payment details.",
          });
          return;
        }
      }

      await db.query("BEGIN");

      try {
        const tickets = [];
        for (let i = 0; i < quantity; i++) {
          const ticketCode = uuidv4();
          const newTicketQuery = await db.query(
            `INSERT INTO tickets 
             (event_id, user_id, ticket_code, price, status, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [eventId, userId, ticketCode, pricePerTicket, "active"]
          );
          tickets.push(newTicketQuery.rows[0]);
        }

        await db.query(
          "DELETE FROM event_waitlist WHERE event_id = $1 AND user_id = $2",
          [eventId, userId]
        );

        const notificationService = new NotificationService(db);
        await notificationService
          .createNotification({
            userId: userId,
            title: `Booking Confirmation: ${event.title}`,
            content: `Thank you for purchasing ${quantity} ticket${
              quantity > 1 ? "s" : ""
            } to "${event.title}". ${
              event.price > 0 ? `Your total was £${pricePaid.toFixed(2)}.` : ""
            }`,
            entityType: "event",
            entityId: parseInt(eventId, 10),
          })
          .catch((error) =>
            console.error(
              "Failed to send booking confirmation notification:",
              error
            )
          );

        await db.query("COMMIT");

        res.status(201).json({
          message: "Booking created successfully",
          event: event,
          tickets: tickets,
          totalPrice: pricePaid,
        });
      } catch (error) {
        await db.query("ROLLBACK");
        console.error("Error creating booking:", error);
        res.status(500).json({
          message: "Failed to create booking",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Unexpected error in booking process:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

const processPayment = (paymentDetails: {
  cardNumber: string;
  expirationDate: string;
  cvc: string;
  zipCode: string;
  amount: number;
}): boolean => {
  console.log("Processing payment with details:", paymentDetails);
  return true;
};

router.get("/:id/availability", async (req: Request, res: Response) => {
  try {
    const { id: eventId } = req.params;

    // Get event details
    const eventQuery = await db.query(
      "SELECT *, NOW() as current_time FROM events WHERE id = $1",
      [eventId]
    );
    const event = eventQuery.rows[0];

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    // Check if event has ended
    if (event.end_time < event.current_time) {
      res.status(200).json({
        isFullyBooked: true,
        message: "Event has already ended",
        availableTickets: 0,
        totalCapacity: event.capacity,
      });
      return;
    }

    // Get current ticket count
    const ticketCountQuery = await db.query(
      "SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND status IN ('active', 'completed')",
      [eventId]
    );
    const ticketCount = parseInt(ticketCountQuery.rows[0].count, 10);

    const availableTickets = Math.max(0, event.capacity - ticketCount);

    res.status(200).json({
      isFullyBooked: ticketCount >= event.capacity,
      availableTickets: availableTickets,
      totalCapacity: event.capacity,
      message:
        ticketCount >= event.capacity
          ? "Event is fully booked"
          : `There are ${availableTickets} tickets available`,
    });
  } catch (error) {
    console.error("Error checking event availability:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /:id/waitlist - Join waitlist
router.post(
  "/:id/waitlist",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: eventId } = req.params;
      const userId = req.user?.id;

      // Check if event exists
      const event = await db.query("SELECT id FROM events WHERE id = $1", [
        eventId,
      ]);
      if (!event.rows[0]) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      // Check if already on waitlist
      const existing = await db.query(
        "SELECT id FROM event_waitlist WHERE event_id = $1 AND user_id = $2",
        [eventId, userId]
      );
      if (existing.rows[0]) {
        res.status(400).json({ message: "You're already on the waitlist" });
        return;
      }

      // Add to waitlist
      await db.query(
        "INSERT INTO event_waitlist (event_id, user_id) VALUES ($1, $2)",
        [eventId, userId]
      );

      res.status(201).json({ message: "Added to waitlist" });
    } catch (error) {
      console.error("Error joining waitlist:", error);
      res.status(500).json({ message: "Failed to join waitlist" });
    }
  }
);

// GET /:id/waitlist - Check if current user is on waitlist
router.get(
  "/:id/waitlist",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: eventId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Check if event exists
      const eventExists = await db.query(
        "SELECT id FROM events WHERE id = $1",
        [eventId]
      );

      if (eventExists.rows.length === 0) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      // Check if user is on waitlist
      const waitlistStatus = await db.query(
        `SELECT EXISTS(
          SELECT 1 FROM event_waitlist 
          WHERE event_id = $1 AND user_id = $2
        ) AS is_on_waitlist`,
        [eventId, userId]
      );

      res.status(200).json({
        isOnWaitlist: waitlistStatus.rows[0].is_on_waitlist,
      });
    } catch (error) {
      console.error("Error checking waitlist status:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// DELETE /:id/waitlist - Leave waitlist
router.delete(
  "/:id/waitlist",
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: eventId } = req.params;
      const userId = req.user?.id;

      const result = await db.query(
        "DELETE FROM event_waitlist WHERE event_id = $1 AND user_id = $2",
        [eventId, userId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ message: "Not on waitlist" });
        return;
      }

      res.status(200).json({ message: "Removed from waitlist" });
    } catch (error) {
      console.error("Error leaving waitlist:", error);
      res.status(500).json({ message: "Failed to leave waitlist" });
    }
  }
);

export default router;
