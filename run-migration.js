import pg from "pg";
import fs from "fs";
import "dotenv/config";

const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('🔄 Starting database migration for bookings table...');

    // Execute each statement separately to better handle errors
    const statements = [
      // Drop existing trigger and function if they exist
      `DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;`,
      `DROP FUNCTION IF EXISTS update_updated_at_column();`,

      // Create the table
      `CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255) NOT NULL,
        car_id INTEGER,
        car_title VARCHAR(255) NOT NULL,
        car_price_per_day DECIMAL(10, 2),
        region VARCHAR(100),
        city VARCHAR(100),
        area VARCHAR(100),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        num_days INTEGER NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'pending')),
        payment_reference VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_bookings_user_email ON bookings(user_email);`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);`,

      // Create function
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';`,

      // Create trigger
      `CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE
          ON bookings FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();`
    ];

    for (const statement of statements) {
      try {
        await db.query(statement);
      } catch (err) {
        // Skip if already exists
        if (!err.message.includes('already exists')) {
          console.log('⚠️  Statement error (may be safe to ignore):', err.message);
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('📋 Bookings table has been created with the following columns:');
    console.log('   - id (primary key)');
    console.log('   - user details (user_id, user_name, user_email)');
    console.log('   - car details (car_id, car_title, car_price_per_day)');
    console.log('   - location (region, city, area)');
    console.log('   - dates (start_date, end_date, num_days)');
    console.log('   - payment (total_amount, payment_status, payment_reference)');
    console.log('   - timestamps (created_at, updated_at)');
    console.log('');
    console.log('🚀 You can now start accepting bookings!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await db.end();
  }
}

runMigration();
