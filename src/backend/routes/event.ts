import { Router, Response, Request, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import db from "../db/connection.js";
import authenticateJWT from "../middleware/authenticateJWT.js";
import bookingRoutes from "./booking.js";
import flagRoutes from "./flag.js";
import myEventsRoutes from "./my-events.js";

const router: Router = Router();
router.use("/booking", bookingRoutes);
router.use("/flag", flagRoutes);
router.use("/my-events", myEventsRoutes);

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

const validateEventInput = [
  body("title")
    .notEmpty()
    .withMessage("Event title is required")
    .isLength({ max: 30 })
    .withMessage("Title cannot exceed 30 characters"),
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
  body("status")
    .isIn(["active", "completed", "cancelled"])
    .withMessage("Invalid event status"),
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
];

router.post(
  "/create-event",
  authenticateJWT,
  validateEventInput,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res
          .status(400)
          .json({ message: "Validation failed", errors: errors.array() });
        return;
      }

      const organiser_id = req.user?.id;
      if (!organiser_id) {
        res.status(401).json({ message: "Unauthorized: organiser ID missing" });
        return;
      }

      const {
        title,
        description,
        startTime,
        endTime,
        address,
        postCode,
        price,
        capacity,
        genderSpecific,
        status,
        categories,
        image,
        city,
        latitude,
        longitude,
      } = req.body;

      const validLatitude = latitude ? parseFloat(latitude) : null;
      const validLongitude = longitude ? parseFloat(longitude) : null;

      const newEvent = await db.query(
        `INSERT INTO events (title, description, start_time, end_time, address, post_code, price, capacity, gender_specific, status, image_url, organiser_id, city, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
        [
          title,
          description,
          startTime,
          endTime,
          address,
          postCode,
          price || 0,
          capacity,
          genderSpecific,
          status,
          image,
          organiser_id,
          city,
          validLatitude,
          validLongitude,
        ]
      );

      if (categories && Array.isArray(categories)) {
        for (const category of categories) {
          await db.query(
            `INSERT INTO event_categories (event_id, category) VALUES ($1, $2)`,
            [newEvent.rows[0].id, category]
          );
        }
      }

      const organiser = await db.query(
        "SELECT username FROM users WHERE id = $1",
        [organiser_id]
      );
      const organiserUsername = organiser.rows[0]?.username || "organiser";

      // Create notification for organiser
      await db.query(
        `INSERT INTO notifications 
         (user_id, title, content, related_entity_type, related_entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          organiser_id,
          "Event Created Successfully",
          `Your event "${title}" has been created and is now live!`,
          "event",
          newEvent.rows[0].id,
        ]
      );

      res.status(201).json({
        message: "Event created successfully",
        event: newEvent.rows[0],
      });
    } catch (error) {
      console.error("Error creating event:", error);
      next(error);
    }
  }
);

router.get(
  "/events",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        search,
        categories,
        free,
        gender,
        sort = "upcoming-first",
        startTime,
        endTime,
        lat,
        lon,
        maxDistance,
        page = 1,
        limit = 24,
      } = req.query;

      // Validate and parse pagination parameters
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string) || 24)
      );
      const offset = (pageNum - 1) * limitNum;

      let query = `
      SELECT 
        e.id, 
        e.title, 
        e.description, 
        e.price, 
        e.gender_specific, 
        e.start_time, 
        e.end_time, 
        e.address, 
        e.post_code, 
        e.image_url, 
        e.latitude, 
        e.longitude, 
        e.city,
        e.flagged_count, 
        e.last_flagged_at,
        (
          SELECT ARRAY_AGG(ec.category)
          FROM event_categories ec
          WHERE ec.event_id = e.id
        ) AS categories
      FROM events e
      WHERE e.status = 'active'
    `;

      const params: any[] = [];
      const whereClauses: string[] = [];

      // Search filter
      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(
          `(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`
        );
      }

      // Category filter
      if (categories) {
        const categoryArray =
          typeof categories === "string"
            ? categories.split(",")
            : Array.isArray(categories)
            ? categories
            : [];

        if (categoryArray.length === 0) {
          res.json({
            data: [],
            pagination: {
              totalItems: 0,
              totalPages: 0,
              currentPage: pageNum,
              itemsPerPage: limitNum,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          });
          return;
        }

        params.push(categoryArray);
        whereClauses.push(`
    EXISTS (
      SELECT 1 FROM event_categories ec 
      WHERE ec.event_id = e.id 
      AND ec.category = ANY($${params.length})
    )
  `);
      } else if (categories === "") {
        res.json({
          data: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: pageNum,
            itemsPerPage: limitNum,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
        return;
      }

      // Free events filter
      if (free === "true") {
        whereClauses.push(`e.price = 0`);
      }

      // Gender filter
      if (gender === "men" || gender === "women") {
        params.push(gender);
        whereClauses.push(
          `(e.gender_specific = 'all' OR e.gender_specific = $${params.length})`
        );
      }

      // Location filter
      if (lat && lon && maxDistance) {
        const latNum = parseFloat(lat as string);
        const lonNum = parseFloat(lon as string);
        const maxDistanceNum = parseFloat(maxDistance as string);

        if (isNaN(latNum) || isNaN(lonNum) || isNaN(maxDistanceNum)) {
          res.status(400).json({ message: "Invalid location parameters" });
          return;
        }

        params.push(latNum, lonNum, maxDistanceNum);
        whereClauses.push(`
        e.latitude IS NOT NULL
        AND e.longitude IS NOT NULL
        AND earth_distance(
          ll_to_earth($${params.length - 2}, $${params.length - 1}),
          ll_to_earth(e.latitude, e.longitude)
        ) <= $${params.length}
      `);
      }

      // Combine all WHERE clauses
      if (whereClauses.length > 0) {
        query += ` AND ${whereClauses.join(" AND ")}`;
      }

      // Sorting optimization
      const sortOptions: Record<string, string> = {
        "upcoming-first": "e.start_time ASC",
        "latest-first": "e.start_time DESC",
        "a-z": "e.title ASC",
        "z-a": "e.title DESC",
        "flag-count-asc": "e.flagged_count ASC NULLS LAST, e.start_time ASC",
        "flag-count-desc": "e.flagged_count DESC NULLS LAST, e.start_time ASC",
        "flagged-recently":
          "e.last_flagged_at DESC NULLS LAST, e.start_time ASC",
        "flagged-oldest": "e.last_flagged_at ASC NULLS LAST, e.start_time ASC",
      };

      const orderBy =
        sortOptions[sort as string] || sortOptions["upcoming-first"];

      // Count query for pagination metadata
      const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
      const countResult = await db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limitNum);

      query += `
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
      params.push(limitNum, offset);

      const events = await db.query(query, params);

      // Format response
      const formattedEvents = events.rows.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        price: event.price,
        genderSpecific: event.gender_specific,
        startTime: event.start_time,
        endTime: event.end_time,
        address: event.address || "N/A",
        postCode: event.post_code || "N/A",
        imageUrl: event.image_url || "",
        latitude: event.latitude,
        longitude: event.longitude,
        city: event.city,
        flaggedCount: event.flagged_count || 0,
        lastFlaggedAt: event.last_flagged_at || null,
        categories: event.categories || [],
      }));

      res.json({
        data: formattedEvents,
        pagination: {
          totalItems: totalCount,
          totalPages,
          currentPage: pageNum,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const eventQuery = `
      SELECT 
        e.id, 
        e.title, 
        e.description, 
        e.price, 
        e.capacity, 
        e.gender_specific, 
        e.start_time, 
        e.end_time, 
        e.status,
        e.address, 
        e.post_code, 
        e.image_url, 
        e.latitude, 
        e.longitude, 
        e.city,
        e.flagged_count,
        e.organiser_id,
        u.username AS organiser_name,
        u.profile_picture_url AS organiser_profile_picture,
        (
          SELECT COALESCE(AVG(r.rating), 0)
          FROM reviews r
          WHERE r.reviewed_user_id = e.organiser_id
        ) AS organiser_rating,
        (
          SELECT COALESCE(COUNT(r.id), 0)
          FROM reviews r
          WHERE r.reviewed_user_id = e.organiser_id
        ) AS organiser_review_count,
        COALESCE(
          ARRAY_AGG(ec.category) FILTER (WHERE ec.category IS NOT NULL),
          '{}'
        ) AS categories
      FROM events e
      LEFT JOIN users u ON u.id = e.organiser_id
      LEFT JOIN event_categories ec ON ec.event_id = e.id
      WHERE e.id = $1
      GROUP BY 
        e.id,
        u.username,
        u.profile_picture_url,
        e.organiser_id
    `;

    const eventResult = await db.query(eventQuery, [id]);

    if (eventResult.rows.length === 0) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    const event = eventResult.rows[0];

    // Format response
    const response = {
      id: event.id,
      title: event.title,
      description: event.description,
      price: event.price,
      capacity: event.capacity,
      genderSpecific: event.gender_specific,
      startTime: event.start_time,
      endTime: event.end_time,
      status: event.status,
      address: event.address || "N/A",
      postCode: event.post_code || "N/A",
      imageUrl: event.image_url || "",
      latitude: event.latitude,
      longitude: event.longitude,
      city: event.city,
      flaggedCount: event.flagged_count,
      categories: event.categories || [],
      organiser: {
        name: event.organiser_name,
        profilePictureUrl: event.organiser_profile_picture,
        averageRating: parseFloat(event.organiser_rating).toFixed(1),
        reviewCount: event.organiser_review_count,
      },
    };

    res.json(response);
    return;
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
});

export default router;
