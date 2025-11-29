import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import db from "../db/connection.js";
import dotenv from "dotenv";
import { validationResult, body } from "express-validator";
import { NotificationService } from "../services/NotificationService.js";

dotenv.config();

const router: Router = Router();

// Function to retrieve JWT secret
const getJwtSecret = (): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }
  return jwtSecret;
};

interface RegisterBody {
  full_name: string;
  email: string;
  username: string;
  password: string;
}

interface User {
  id: number;
  role: "user" | "admin" | "banned";
  full_name: string;
  email: string;
  username: string;
  password_hash: string;
}

// Input validation for registration
const validateRegisterInput = [
  body("full_name").notEmpty().withMessage("Full name is required"),
  body("email").isEmail().withMessage("Invalid email address"),
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ max: 20 })
    .withMessage("Username must be 20 characters or less")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

router.post(
  "/register",
  validateRegisterInput,
  async (req: Request<{}, {}, RegisterBody>, res: Response): Promise<void> => {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
      return;
    }

    const { full_name, email, username, password } = req.body;

    console.log("Attempting to register user with username:", username);

    try {
      // Check if email or username already exists
      console.time("Check Existing User");
      const existingUser = await db.query(
        "SELECT id, email, username FROM users WHERE email = $1 OR username = $2",
        [email, username]
      );
      console.timeEnd("Check Existing User");

      if (existingUser.rows.length > 0) {
        const conflictField =
          existingUser.rows[0].email === email ? "Email" : "Username";
        console.log(`${conflictField} already taken:`, existingUser.rows[0]);
        res.status(409).json({ message: `${conflictField} already taken` });
        return;
      }

      if (username.length > 20) {
        res
          .status(400)
          .json({ message: "Username must be 20 characters or less" });
        return;
      }

      // Hash password
      console.time("Hash Password");
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      console.timeEnd("Hash Password");

      // Insert new user
      console.time("Insert User");
      const newUser = await db.query(
        `INSERT INTO users (full_name, email, username, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, username, role`,
        [full_name, email, username, hashedPassword]
      );
      console.timeEnd("Insert User");

      // Send welcome notification
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          userId: newUser.rows[0].id,
          title: "Welcome to Event Qibla!",
          content: `Hi ${username}, you've successfully registered. Welcome to our community!`,
          entityType: "user",
          entityId: newUser.rows[0].id,
        });
      } catch (notifError) {
        console.error("Failed to create welcome notification:", notifError);
      }

      // Generate JWT token for automatic login after registration
      const token = jwt.sign(
        { userId: newUser.rows[0].id, role: newUser.rows[0].role },
        getJwtSecret() as string,
        { expiresIn: process.env.JWT_EXPIRY || "1h" } as SignOptions
      );

      console.log(
        "User registered and logged in successfully:",
        newUser.rows[0]
      );

      res.status(201).json({
        message: "User registered and logged in successfully",
        user: newUser.rows[0],
        token,
      });
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error instanceof Error) {
        res.status(500).json({ message: "Failed to hash password" });
      } else if (error.code === "23505") {
        // PostgreSQL unique violation error
        res.status(409).json({ message: "Email or username already taken" });
      } else {
        res.status(500).json({ message: "Server error", error: error.message });
      }
    }
  }
);

// Login Route
router.post(
  "/login",
  async (
    req: Request<{}, {}, { login: string; password: string; from?: string }>,
    res: Response
  ): Promise<void> => {
    const { login, password, from } = req.body;

    if (!login) {
      res.status(400).json({ message: "Email or username is required" });
      return;
    }

    console.log("Attempting to login with:", login);

    try {
      // Check if login is email or username
      const isEmail = login.includes("@");

      // Query based on whether the input is an email or username
      const userResult = await db.query(
        `SELECT id, full_name, email, username, password_hash, role 
         FROM users 
         WHERE ${isEmail ? "email = $1" : "username = $1"}`,
        [login]
      );

      if (userResult.rows.length === 0) {
        console.log("Invalid credentials, no user found with:", login);
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }

      const user = userResult.rows[0];

      // Check if user is banned
      if (user.role === "banned") {
        console.log("Login attempt by banned user:", login);
        res.status(403).json({ message: "Your account has been banned" });
        return;
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        console.log("Invalid credentials, password mismatch for user:", login);
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        getJwtSecret() as string,
        { expiresIn: process.env.JWT_EXPIRY || "1h" } as SignOptions
      );

      console.log("Login successful for user:", user.username);

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          username: user.username,
        },
        token,
        redirectTo: from || "/",
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

export default router;
