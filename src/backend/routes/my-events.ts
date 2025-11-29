import { Router, Response, Request, NextFunction } from "express";
import db from "../db/connection.js";
import authenticateJWT from "../middleware/authenticateJWT.js";
import { validationResult, body } from "express-validator";
import { NotificationService } from "../services/NotificationService.js";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

interface EventData {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  address: string;
  post_code: string;
  price: number;
  capacity: number;
  gender_specific: string;
  image_url: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
}

// Get all events owned by the current user with optional status filter
router.get(
  "/",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Pagination configuration
      const defaultLimit = 12;
      const maxLimit = 24;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        Math.max(1, parseInt(req.query.limit as string) || defaultLimit),
        maxLimit
      );
      const offset = (page - 1) * limit;

      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const validStatuses = ["active", "cancelled", "completed"] as const;

      if (
        status &&
        !validStatuses.includes(status as (typeof validStatuses)[number])
      ) {
        res.status(400).json({
          message: "Invalid status filter",
          validStatuses,
        });
        return;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM events e
        WHERE e.organiser_id = $1
        ${status ? `AND e.status = $2` : ""}
      `;

      const countParams: (string | number)[] = [userId];
      if (status) countParams.push(status);

      const countResult = await db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);

      const eventsQuery = `
        WITH event_attendees AS (
          SELECT event_id, COUNT(id) AS attendee_count
          FROM tickets
          WHERE status = 'active'
          GROUP BY event_id
        )
        SELECT 
          e.id, 
          e.title, 
          COALESCE(e.image_url, '/default-event.jpg') AS image_url,
          e.start_time, 
          e.end_time, 
          e.address, 
          e.city, 
          e.post_code, 
          e.status,
          e.gender_specific,
          e.price,
          COALESCE(
            (SELECT ARRAY_AGG(DISTINCT ec.category)
             FROM event_categories ec 
             WHERE ec.event_id = e.id),
            '{}'::text[]
          ) AS categories,
          COALESCE(ea.attendee_count, 0) AS attendee_count
        FROM events e
        LEFT JOIN event_attendees ea ON ea.event_id = e.id
        WHERE e.organiser_id = $1
        ${status ? `AND e.status = $2` : ""}
        ORDER BY e.start_time ASC
        LIMIT $${status ? 3 : 2} OFFSET $${status ? 4 : 3}
      `;

      const queryParams: (string | number)[] = [userId];
      if (status) queryParams.push(status);
      queryParams.push(limit, offset);

      const result = await db.query(eventsQuery, queryParams);

      res.json({
        data: result.rows.map((event) => ({
          id: event.id,
          title: event.title,
          imageUrl: event.image_url,
          categories: event.categories,
          status: event.status,
          startTime: event.start_time,
          endTime: event.end_time,
          address: event.address,
          genderSpecific: event.gender_specific,
          city: event.city,
          postCode: event.post_code,
          price: event.price,
          attendeeCount: Number(event.attendee_count),
        })),
        pagination: {
          totalItems: totalCount,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
      return;
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const eventId = req.params.id;
      const { cancellationReason } = req.body;

      if (!userId || !userRole) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      if (!cancellationReason) {
        res.status(400).json({ message: "Cancellation reason is required" });
        return;
      }

      // Get event details
      const eventResult = await db.query(
        `SELECT id, title, organiser_id, price FROM events WHERE id = $1`,
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      const event = eventResult.rows[0];
      const isorganiser = event.organiser_id === userId;
      const isAdmin = userRole === "admin";

      if (!isorganiser && !isAdmin) {
        res.status(403).json({
          message: `You don't have permission to cancel this event ${userRole}`,
        });
        return;
      }

      const isPaidEvent = event.price > 0;

      const attendeesResult = await db.query(
        `SELECT DISTINCT t.user_id, u.email 
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.event_id = $1 AND t.status = 'active'`,
        [eventId]
      );

      const attendeeCount = attendeesResult.rows.length;

      await db.query("BEGIN");

      try {
        // Cancel tickets
        await db.query(
          `UPDATE tickets SET status = 'cancelled'
           WHERE event_id = $1 AND status = 'active'`,
          [eventId]
        );

        // Mark event as cancelled
        await db.query(
          `UPDATE events 
           SET status = 'cancelled', 
               flagged_count = 0,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [eventId]
        );

        const notificationService = new NotificationService(db);

        const notificationPromises = attendeesResult.rows.map((attendee) =>
          notificationService
            .createNotification({
              userId: attendee.user_id,
              title: `Event Cancelled${
                isAdmin && !isorganiser ? " By Administrator" : ""
              }: ${event.title} `,
              content: `The event "${event.title}" has been cancelled.${
                isPaidEvent ? " You will be refunded shortly." : ""
              } Reason: ${cancellationReason}`,
              entityType: "event",
              entityId: Number(eventId),
            })
            .catch((error) => {
              console.error(
                `Failed to send notification to user ${attendee.user_id}:`,
                error
              );
            })
        );

        await Promise.all(notificationPromises);
        await db.query("COMMIT");

        res.json({
          message: "Event cancelled successfully",
          attendeeCount,
        });
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
);

// Get attendees for an event
router.get(
  "/:id/attendees",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const eventId = req.params.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1); // Ensure page >= 1
      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      ); // Default 20, max 50 per page

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Verify event ownership
      const ownershipCheck = await db.query(
        "SELECT id FROM events WHERE id = $1 AND organiser_id = $2",
        [eventId, userId]
      );

      if (ownershipCheck.rows.length === 0) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM tickets t
        WHERE t.event_id = $1 AND t.status IN ('active', 'completed')
      `;
      const countResult = await db.query(countQuery, [eventId]);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      // Validate requested page
      const currentPage = Math.min(page, totalPages);

      // Get paginated attendees
      const attendeesQuery = `
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.username,
          t.purchase_time,
          t.status,
          t.price,
          t.ticket_code
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.event_id = $1 AND t.status IN ('active', 'completed')
        ORDER BY t.purchase_time DESC
        LIMIT $2 OFFSET $3
      `;

      const offset = (currentPage - 1) * limit;
      const attendeesResult = await db.query(attendeesQuery, [
        eventId,
        limit,
        offset,
      ]);

      res.json({
        data: attendeesResult.rows.map((attendee) => ({
          id: attendee.id,
          fullName: attendee.full_name,
          email: attendee.email,
          username: attendee.username,
          purchaseTime: attendee.purchase_time,
          status: attendee.status,
          pricePaid: attendee.price,
          ticketCode: attendee.ticket_code,
        })),
        pagination: {
          totalItems: total,
          totalPages,
          currentPage,
          itemsPerPage: limit,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id/attendees/count",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const eventId = req.params.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Check if user is organiser or admin
      const eventQuery = await db.query(
        `SELECT organiser_id FROM events WHERE id = $1`,
        [eventId]
      );

      if (eventQuery.rows.length === 0) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      const isOrganiser = eventQuery.rows[0].organiser_id === userId;
      const isAdmin = userRole === "admin";

      if (!isOrganiser && !isAdmin) {
        res.status(403).json({
          message: "You don't have permission to view this information",
        });
        return;
      }

      // Get active ticket count
      const countQuery = await db.query(
        `SELECT COUNT(*) as count 
         FROM tickets 
         WHERE event_id = $1 AND status = 'active'`,
        [eventId]
      );

      res.json({
        count: parseInt(countQuery.rows[0].count) || 0,
        eventId: eventId,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/edit-event/:id",
  authenticateJWT,
  [
    body("description").notEmpty().withMessage("Event description is required"),
    body("startTime").isISO8601().withMessage("Invalid start time format"),
    body("endTime").isISO8601().withMessage("Invalid end time format"),
    body("address").notEmpty().withMessage("Event address is required"),
    body("postCode")
      .matches(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i)
      .withMessage("Invalid postcode format"),
    body("city").notEmpty().withMessage("City is required"),
    body("latitude")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90")
      .optional({ nullable: true }),
    body("longitude")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180")
      .optional({ nullable: true }),
    body("capacity")
      .isInt({ gt: 0 })
      .withMessage("Capacity must be a positive integer"),
    body("genderSpecific")
      .isIn(["all", "men", "women"])
      .withMessage("Invalid gender specification"),
    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a non-negative number")
      .optional({ nullable: true }),
    body("categories")
      .isArray()
      .withMessage("Categories must be an array")
      .optional({ nullable: true }),
    body("categories.*")
      .isString()
      .withMessage("Each category must be a string")
      .optional({ nullable: true }),
    body("image")
      .custom((value) => {
        if (!value) return true;
        const base64Length =
          value.length * (3 / 4) -
          (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB
        if (base64Length > maxSizeBytes) {
          throw new Error("Image size must be under 5MB");
        }
        return true;
      })
      .optional({ nullable: true }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
        return;
      }

      const organiser_id = req.user?.id;
      const eventId = parseInt(req.params.id);

      if (!organiser_id) {
        res.status(401).json({
          message: "Unauthorized: organiser ID missing",
        });
        return;
      }

      // Verify the event belongs to this organiser
      const existingEvent = await db.query(
        `SELECT * FROM events WHERE id = $1 AND organiser_id = $2`,
        [eventId, organiser_id]
      );

      if (existingEvent.rows.length === 0) {
        res.status(404).json({
          message: "Event not found or you don't have permission to edit it",
        });
        return;
      }

      // Get original event details and current attendee count
      const originalEvent = await db.query<
        EventData & { ticket_count: number }
      >(
        `SELECT 
          e.title, e.description, e.start_time, e.end_time, e.address, e.post_code, 
          e.price, e.capacity, e.gender_specific, e.image_url, e.city, 
          e.latitude, e.longitude,
          ARRAY(SELECT category FROM event_categories WHERE event_id = e.id) as categories,
          (SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status = 'active') as ticket_count
         FROM events e
         WHERE e.id = $1`,
        [eventId]
      );
      const original = originalEvent.rows[0];

      const {
        description = original.description,
        startTime = original.start_time,
        endTime = original.end_time,
        address = original.address,
        postCode = original.post_code,
        price = original.price,
        capacity = original.capacity,
        genderSpecific = original.gender_specific,
        categories = original.categories,
        image = original.image_url,
        city = original.city,
        latitude = original.latitude,
        longitude = original.longitude,
      } = req.body;

      // Check if capacity is being decreased below current attendee count
      if (capacity < original.capacity) {
        const newCapacity = parseInt(capacity as string);
        if (original.ticket_count > newCapacity) {
          const ticketsToRemove = original.ticket_count - newCapacity;
          res.status(400).json({
            message: `Cannot reduce capacity below current number of tickets. You need to remove ${ticketsToRemove} ticket(s) first.`,
            currentTickets: original.ticket_count,
            proposedCapacity: newCapacity,
            ticketsToRemove: ticketsToRemove,
          });
          return;
        }
      }

      const validLatitude = latitude
        ? parseFloat(latitude as string)
        : original.latitude;
      const validLongitude = longitude
        ? parseFloat(longitude as string)
        : original.longitude;

      // Compare changes before updating
      const changes: string[] = [];

      const compareDates = (
        date1: string | Date,
        date2: string | Date
      ): boolean => {
        return new Date(date1).getTime() === new Date(date2).getTime();
      };

      const compareNumbers = (
        num1: number | string | null,
        num2: number | string | null
      ): boolean => {
        return parseFloat(num1 as any) === parseFloat(num2 as any);
      };

      if (original.description !== description) changes.push("description");
      if (!compareDates(original.start_time, startTime))
        changes.push("start time");
      if (!compareDates(original.end_time, endTime)) changes.push("end time");
      if (original.address !== address) changes.push("location");
      if (original.post_code !== postCode) changes.push("post code");
      if (!compareNumbers(original.price, price)) changes.push("price");
      if (original.capacity !== capacity) changes.push("capacity");
      if (original.gender_specific !== genderSpecific)
        changes.push("gender specification");
      if (original.city !== city) changes.push("city");
      if (original.image_url !== image) changes.push("image");

      // Compare categories
      const originalCategories: string[] = original.categories || [];
      const newCategories: string[] = Array.isArray(categories)
        ? categories
        : [];
      const categoriesChanged =
        originalCategories.length !== newCategories.length ||
        !originalCategories.every((cat: string) => newCategories.includes(cat));

      if (categoriesChanged) changes.push("categories");

      if (changes.length > 0) {
        // Update the event
        const updatedEvent = await db.query(
          `UPDATE events 
           SET description = $1,
               start_time = $2,
               end_time = $3,
               address = $4,
               post_code = $5,
               price = $6,
               capacity = $7,
               gender_specific = $8,
               image_url = $9,
               city = $10,
               latitude = $11,
               longitude = $12,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $13 AND organiser_id = $14
           RETURNING *`,
          [
            description,
            startTime,
            endTime,
            address,
            postCode,
            price,
            capacity,
            genderSpecific,
            image,
            city,
            validLatitude,
            validLongitude,
            eventId,
            organiser_id,
          ]
        );

        // Update categories if they changed
        if (categoriesChanged) {
          await db.query(`DELETE FROM event_categories WHERE event_id = $1`, [
            eventId,
          ]);

          if (newCategories.length > 0) {
            // Remove duplicate categories
            const uniqueCategories = [
              ...new Set(newCategories.filter((c: string) => c)),
            ];

            for (const category of uniqueCategories) {
              await db.query(
                `INSERT INTO event_categories (event_id, category) VALUES ($1, $2)
                 ON CONFLICT (event_id, category) DO NOTHING`,
                [eventId, category]
              );
            }
          }
        }

        // Notify attendees for event changes
        const attendees = await db.query<{ user_id: number }>(
          `SELECT DISTINCT user_id FROM tickets 
           WHERE event_id = $1 AND status = 'active'`,
          [eventId]
        );

        if (attendees.rows.length > 0) {
          const notificationService = new NotificationService();
          const eventTitle = original.title;
          const timeChanged =
            changes.includes("start time") || changes.includes("end time");
          const locationChanged =
            changes.includes("location") ||
            changes.includes("post code") ||
            changes.includes("city");

          let changeMessage = "";

          if (timeChanged && locationChanged) {
            changeMessage = `The event time and location have changed. Please update your calendar schedule.`;
          } else if (timeChanged) {
            changeMessage = `The event time has changed. Please update your calendar schedule.`;
          } else if (locationChanged) {
            changeMessage = `The event location has changed. Please update your travel plans.`;
          } else {
            changeMessage =
              changes.length === 1
                ? `The ${changes[0]} has been updated`
                : `Several details have been updated: ${changes.join(", ")}`;
          }

          for (const attendee of attendees.rows) {
            try {
              await notificationService.createNotification({
                userId: attendee.user_id,
                title: `Event Updated: ${eventTitle}`,
                content: `The event you're attending has been updated. ${changeMessage}`,
                entityType: "event",
                entityId: eventId,
              });
            } catch (notifError) {
              console.error(
                `Failed to notify user ${attendee.user_id}:`,
                notifError
              );
            }
          }
        }
      }

      // Get the updated event with categories
      const eventWithCategories = await db.query<EventData>(
        `SELECT e.*, 
                ARRAY(SELECT category FROM event_categories WHERE event_id = e.id) as categories
         FROM events e
         WHERE e.id = $1`,
        [eventId]
      );

      res.status(200).json({
        message:
          changes.length > 0
            ? "Event updated successfully"
            : "No changes detected",
        event: eventWithCategories.rows[0],
        changes: changes.length > 0 ? changes : undefined,
      });
    } catch (error) {
      console.error("Error updating event:", error);
      next(error);
    }
  }
);

// GET endpoint to fetch event details for editing
router.get(
  "/edit-event/:id",
  authenticateJWT,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organiser_id = req.user?.id;
      const eventId = parseInt(req.params.id);

      if (!organiser_id) {
        res.status(401).json({
          message: "Unauthorized: organiser ID missing",
        });
        return;
      }

      await db.query(
        `UPDATE events 
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organiser_id = $2`,
        [eventId, organiser_id]
      );

      const event = await db.query(
        `SELECT e.*, 
                ARRAY(SELECT category FROM event_categories WHERE event_id = e.id) as categories
         FROM events e
         WHERE e.id = $1 AND e.organiser_id = $2`,
        [eventId, organiser_id]
      );

      if (event.rows.length === 0) {
        res.status(404).json({
          message: "Event not found or you don't have permission to edit it",
        });
        return;
      }

      res.status(200).json(event.rows[0]);
      return;
    } catch (error) {
      console.error("Error fetching event for editing:", error);
      next(error);
    }
  }
);

export default router;
