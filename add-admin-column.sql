-- Add is_admin column to users table
-- Run this SQL in your database to enable admin functionality

-- Add the is_admin column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create an admin user (change the credentials as needed)
-- Password: admin123 (hashed with bcrypt, salt rounds 10)
-- You should change this password after first login
INSERT INTO users (username, email, password, is_admin)
VALUES (
  'admin',
  'admin@hoodcarrentals.com',
  '$2b$10$rQZx.8qJ5qxKxB3hW8zEV.hZxWKvXJ6P5rqGxH7xN7K8xQ6xH5xKm', -- password: admin123
  true
)
ON CONFLICT (username) DO NOTHING;

-- Alternative: Update an existing user to be an admin
-- Uncomment and modify the username below if you want to make an existing user an admin
-- UPDATE users SET is_admin = true WHERE username = 'your_username';
