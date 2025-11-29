import db from "./connection.js";
import bcrypt from "bcrypt";

const initialiseAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await db.query(
      "SELECT * FROM users WHERE email = 'admin@email.com'"
    );

    if (existingAdmin.rows.length === 0) {
      // Hash admin password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash("admin123", saltRounds);

      // Create admin user
      await db.query(
        `INSERT INTO users (full_name, email, username, password_hash, role) 
         VALUES ($1, $2, $3, $4, 'admin')`,
        ["Admin", "admin@email.com", "admin", hashedPassword]
      );
      console.log("Admin account created successfully");
    } else {
      console.log("Admin account already exists");
    }
  } catch (error) {
    console.error("Error initialising admin account:", error);
  }
};

export default initialiseAdmin;
