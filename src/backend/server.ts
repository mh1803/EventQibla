import express from "express";
import cors from "cors";
import db from "./db/connection.js";
import initialiseAdmin from "./db/intialiseAdmin.js";
import router from "./routes/router.js";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import { setupEventCompletionCron } from "./cron/eventCompletionCron.js";
import { setupEventCleanupCron } from "./cron/eventCleanupCron.js";
import { setupTicketCleanupCron } from "./cron/ticketCleanupCron.js";
import { setupEventReminderCron } from "./cron/eventReminderCron.js";

dotenv.config(); // Loads .env variables

// Initialises Express app
const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Define ports and origins from .env
const PORT = process.env.PORT || 3000;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3001;
const FRONTEND_ORIGIN =
  process.env.CORS_ORIGIN || `http://localhost:${FRONTEND_PORT}`;

// CORS Config
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

app.use("/api", router);

// Start server
const startServer = async () => {
  try {
    // Connect to database first
    await db.connect();
    console.log("Database connected successfully");

    // Initialise admin account
    await initialiseAdmin();

    // Setup all scheduled cron jobs
    setupEventCompletionCron();
    setupEventCleanupCron();
    setupTicketCleanupCron();
    setupEventReminderCron();

    // Run server on port
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
