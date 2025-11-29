import pg from "pg";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;

// Use environment variables for database connection
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
});

db.connect()
  .then(() => console.log("Connected to the database"))
  .catch((err) => console.error("Database connection error:", err));

// Graceful Shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down database connection pool...");
  await db.end();
  console.log("Database connection pool closed.");
  process.exit(0);
});

export default db;
