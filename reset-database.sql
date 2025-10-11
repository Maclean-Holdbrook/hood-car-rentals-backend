-- ===============================================
-- Hood Car Rentals - Database Reset Script
-- ===============================================
-- This script will DROP all existing tables and recreate them fresh
-- WARNING: This will DELETE ALL DATA!

-- Drop existing tables (if they exist)
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS testimonials CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===============================================
-- Create Users Table
-- ===============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ===============================================
-- Create Testimonials Table
-- ===============================================
CREATE TABLE testimonials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- Create Bookings Table (for future use)
-- ===============================================
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    car_title VARCHAR(255) NOT NULL,
    car_price DECIMAL(10, 2) NOT NULL,
    region VARCHAR(100),
    city VARCHAR(100),
    area VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    num_days INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_reference VARCHAR(255) UNIQUE,
    payment_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_payment_ref ON bookings(payment_reference);

-- ===============================================
-- Insert Sample Data (Optional)
-- ===============================================
-- Sample user (password is 'password123' hashed with bcrypt)
-- INSERT INTO users (username, email, password) VALUES
-- ('testuser', 'test@example.com', '$2b$10$rKvV8YwZ4UqEqYqYqYqYqO7gY6qYqYqYqYqYqYqYqYqYqYqYqYqYq');

-- Sample testimonials
INSERT INTO testimonials (name, rating, message) VALUES
('John Doe', 5, 'Excellent service! The car was in perfect condition and the rental process was smooth.'),
('Jane Smith', 4, 'Great experience overall. Would definitely rent again.');

-- ===============================================
-- Verification Queries
-- ===============================================
-- Run these to verify the setup:
-- SELECT * FROM users;
-- SELECT * FROM testimonials;
-- SELECT * FROM bookings;
