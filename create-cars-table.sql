-- Create cars table for managing car inventory
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price_per_day DECIMAL(10, 2) NOT NULL,
  transmission VARCHAR(50) DEFAULT 'Automatic',
  seats INTEGER DEFAULT 5,
  has_ac BOOLEAN DEFAULT true,
  category VARCHAR(100) DEFAULT 'Sedan',
  image_url TEXT,
  image_url_2 TEXT,
  image_url_3 TEXT,
  image_url_4 TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cars_available ON cars(is_available);
CREATE INDEX IF NOT EXISTS idx_cars_category ON cars(category);

-- Insert some sample cars
INSERT INTO cars (title, description, price_per_day, transmission, seats, has_ac, category, image_url, is_available)
VALUES
  ('Toyota Corolla', 'Compact, fuel-efficient, and perfect for city driving.', 45.00, 'Automatic', 5, true, 'Sedan', 'https://example.com/corolla.jpg', true),
  ('Hyundai Tucson', 'Spacious SUV for families and long trips.', 65.00, 'Automatic', 5, true, 'SUV', 'https://example.com/tucson.jpg', true),
  ('Mercedes C300', 'Premium comfort and performance for special occasions.', 120.00, 'Automatic', 5, true, 'Luxury', 'https://example.com/mercedes.jpg', true),
  ('Honda Civic', 'Reliable and stylish sedan perfect for daily commuting.', 40.00, 'Automatic', 5, true, 'Sedan', 'https://example.com/civic.jpg', true),
  ('Ford Explorer', 'Large SUV with plenty of space for family adventures.', 85.00, 'Automatic', 7, true, 'SUV', 'https://example.com/explorer.jpg', true),
  ('BMW 3 Series', 'Luxury sedan with sporty performance and elegant design.', 110.00, 'Automatic', 5, true, 'Luxury', 'https://example.com/bmw.jpg', true)
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_cars_updated_at ON cars;
CREATE TRIGGER update_cars_updated_at
    BEFORE UPDATE ON cars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
