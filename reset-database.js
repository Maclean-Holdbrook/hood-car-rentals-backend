import pg from "pg";
import fs from "fs";
import "dotenv/config";

const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function resetDatabase() {
  try {
    console.log("🔄 Starting database reset...");

    // Read the SQL file
    const sqlScript = fs.readFileSync("./reset-database.sql", "utf8");

    // Execute the SQL script
    await db.query(sqlScript);

    console.log("✅ Database reset successfully!");
    console.log("📊 Tables created:");
    console.log("   - users");
    console.log("   - testimonials");
    console.log("   - bookings");
    console.log("\n💡 Sample testimonials have been added.");

  } catch (error) {
    console.error("❌ Error resetting database:", error.message);
  } finally {
    await db.end();
  }
}

resetDatabase();
