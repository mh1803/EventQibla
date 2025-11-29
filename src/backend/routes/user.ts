import { Router, Request, Response, NextFunction } from "express";
import db from "../db/connection.js";
import authenticateJWT from "../middleware/authenticateJWT.js";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "user" | "admin" | "banned";
  };
}

const DEFAULT_PROFILE_PIC = "/images/default_profile.png";

// Helper type for async Express handlers
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

// Get user profile
router.get("/me", authenticateJWT, (async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).end();
      return;
    }

    const userQuery = await db.query(
      `SELECT id, username, email, full_name, profile_picture_url, created_at, role
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (userQuery.rows.length === 0) {
      res.status(404).end();
      return;
    }

    const ratingQuery = await db.query(
      `SELECT AVG(rating) as average_rating, COUNT(*) as rating_count
       FROM reviews 
       WHERE reviewed_user_id = $1`,
      [userId]
    );

    const userData = {
      ...userQuery.rows[0],
      rating: parseFloat(ratingQuery.rows[0].average_rating) || 0,
      ratingCount: parseInt(ratingQuery.rows[0].rating_count) || 0,
    };

    res.json(userData);
  } catch (error) {
    next(error);
  }
}) as AsyncHandler);

// Update profile picture endpoint
router.post("/profile-picture", authenticateJWT, (async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).end();
      return;
    }

    if (!req.body.image && req.body.image !== null) {
      res.status(400).json({
        message: "Image data is required as base64 string or null to remove",
      });
      return;
    }

    if (req.body.image === null) {
      await db.query(
        `UPDATE users 
         SET profile_picture_url = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [DEFAULT_PROFILE_PIC, userId]
      );
      res.json({
        message: "Profile picture removed successfully",
        profile_picture_url: DEFAULT_PROFILE_PIC,
      });
      return;
    }

    if (typeof req.body.image !== "string") {
      res.status(400).json({
        message: "Image data must be a base64 string",
      });
      return;
    }

    const imageSize = Buffer.byteLength(req.body.image, "utf8");
    if (imageSize > 5 * 1024 * 1024) {
      res.status(413).json({
        message: "Image size exceeds 5MB limit",
      });
      return;
    }

    const matches = req.body.image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({
        message: "Invalid image format",
      });
      return;
    }

    const imageType = matches[1].toLowerCase();
    const allowedTypes = ["jpeg", "jpg", "png", "gif", "webp"];
    if (!allowedTypes.includes(imageType)) {
      res.status(400).json({
        message: "Only JPEG, PNG, GIF, and WEBP images are allowed",
      });
      return;
    }

    await db.query(
      `UPDATE users 
       SET profile_picture_url = $1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [req.body.image, userId]
    );

    res.json({
      message: "Profile picture updated successfully",
      profile_picture_url: req.body.image,
    });
  } catch (error) {
    next(error);
  }
}) as AsyncHandler);

// Get profile picture endpoint by user ID
router.get("/:id/profile-picture", (async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }

    const result = await db.query(
      `SELECT profile_picture_url 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const profilePicture =
      result.rows[0].profile_picture_url || DEFAULT_PROFILE_PIC;

    res.json({
      image: profilePicture,
    });
  } catch (error) {
    next(error);
  }
}) as AsyncHandler);

// Delete profile picture endpoint
router.delete("/profile-picture", authenticateJWT, (async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Update the user's profile picture to the default
    const result = await db.query(
      `UPDATE users 
       SET profile_picture_url = $1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING profile_picture_url`,
      [DEFAULT_PROFILE_PIC, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      message: "Profile picture removed successfully",
      profile_picture_url: DEFAULT_PROFILE_PIC,
    });
  } catch (error) {
    next(error);
  }
}) as AsyncHandler);

// Add review for a user
router.post("/:id/review", authenticateJWT, (async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const reviewerId = req.user?.id;
    if (!reviewerId) {
      res.status(401).end();
      return;
    }

    const reviewedUserId = parseInt(req.params.id);
    if (isNaN(reviewedUserId)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    if (reviewerId === reviewedUserId) {
      res.status(400).json({ message: "You cannot review yourself" });
      return;
    }

    const { rating } = req.body;

    if (rating === undefined || typeof rating !== "number") {
      res
        .status(400)
        .json({ message: "Rating is required and must be a number" });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ message: "Rating must be between 1 and 5" });
      return;
    }

    // Check if the reviewer has already reviewed this user
    const existingReview = await db.query(
      `SELECT id FROM reviews 
       WHERE reviewer_id = $1 AND reviewed_user_id = $2`,
      [reviewerId, reviewedUserId]
    );

    if (existingReview.rows.length > 0) {
      res.status(400).json({ message: "You have already reviewed this user" });
      return;
    }

    // Check if the reviewed user exists
    const userExists = await db.query(`SELECT id FROM users WHERE id = $1`, [
      reviewedUserId,
    ]);

    if (userExists.rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Insert the review
    await db.query(
      `INSERT INTO reviews 
       (reviewer_id, reviewed_user_id, rating, created_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [reviewerId, reviewedUserId, rating]
    );

    res.status(201).json({ message: "Review submitted successfully" });
  } catch (error) {
    next(error);
  }
}) as AsyncHandler);

// Get user's average rating
router.get("/:id/rating", (async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const result = await db.query(
      `SELECT 
         COUNT(*) as review_count,
         COALESCE(AVG(rating), 0) as average_rating
       FROM reviews 
       WHERE reviewed_user_id = $1`,
      [userId]
    );

    const reviewCount = parseInt(result.rows[0].review_count) || 0;
    const averageRating = parseFloat(result.rows[0].average_rating) || 0;

    res.json({
      reviewCount,
      averageRating: Math.round(averageRating * 10) / 10, // Rounds to 1 decimal place
    });
  } catch (error) {
    next(error);
  }
}) as AsyncHandler);

export default router;
