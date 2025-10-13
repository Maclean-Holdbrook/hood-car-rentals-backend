# Bookings System Setup Instructions

## Overview
This guide will help you set up the bookings tracking system with payment status support.

## Changes Made

### 1. Google OAuth Authentication
- Added `/auth/google` endpoint to handle Google Sign-In
- Automatically creates new users or logs in existing users
- Fixes the "Access blocked: Authorization Error"

### 2. Bookings Database Table
- Created `bookings` table to track all booking submissions
- Includes fields for user info, car details, location, dates, and payment status
- Payment status can be: 'paid', 'unpaid', or 'pending'

### 3. Backend Updates
- `/send-booking-quote` now saves bookings to database (with 'unpaid' status)
- `/paystack/verify-payment` saves bookings with 'paid' status and payment reference
- `/admin/bookings` endpoint to retrieve all bookings for admin dashboard
- Bookings are saved regardless of payment status

## Database Setup

### Step 1: Run the Migration

You need to create the bookings table in your database. Run this command:

```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME -f create-bookings-table.sql
```

Replace:
- `YOUR_DB_HOST` with your database host (from .env)
- `YOUR_DB_USER` with your database user (from .env)
- `YOUR_DB_NAME` with your database name (from .env)

You'll be prompted for your database password.

### Alternative: Using a Database Client

If you prefer using a GUI tool (like pgAdmin, DBeaver, or Supabase Dashboard):

1. Open `create-bookings-table.sql`
2. Copy the entire SQL content
3. Paste and execute it in your database client's SQL editor

## Testing

### 1. Test Google Login
1. Start your backend: `cd "Hood Car Rentals Backend" && node index.js`
2. Start your frontend: `cd car && npm start`
3. Go to login/signup page
4. Click "Sign in with Google"
5. You should now be able to log in successfully

### 2. Test Booking Submission (Unpaid)
1. Log in to the app
2. Select a car and fill in booking details
3. Click "Send Request" (don't pay)
4. Check admin dashboard - booking should appear with "Unpaid" status

### 3. Test Booking with Payment
1. Log in to the app
2. Select a car and fill in booking details
3. Click "Pay Now" and complete payment
4. Check admin dashboard - booking should appear with "Paid" status and payment reference

### 4. Admin Dashboard
1. Log in as admin at `/admin/login`
2. Go to "Bookings" section
3. You should see all bookings with:
   - User details
   - Car information
   - Location (Region, City, Area)
   - Dates and duration
   - Total amount
   - Payment status (Paid/Unpaid badge)
   - Payment reference (if paid)

## Features

✅ Google OAuth authentication working
✅ All booking submissions are recorded in database
✅ Payment status tracked (paid/unpaid)
✅ Admin can view all bookings in dashboard
✅ Bookings saved even without payment
✅ Email notifications sent for both paid and unpaid bookings

## Next Steps

1. Run the database migration (see Step 1 above)
2. Restart your backend server
3. Test the Google login functionality
4. Test booking submissions (with and without payment)
5. Verify bookings appear in admin dashboard

## Troubleshooting

### Google Login Still Not Working
- Make sure you have set up Google OAuth in Google Cloud Console
- Verify `VITE_GOOGLE_CLIENT_ID` is set in your frontend `.env` file
- Check that the Google Client ID matches in both places

### Bookings Not Appearing
- Verify the bookings table was created: `SELECT * FROM bookings;`
- Check backend logs for any database errors
- Ensure your database connection is working

### Payment Status Not Updating
- Check Paystack configuration in `.env`
- Verify payment webhook is set up correctly
- Check backend logs during payment verification

## Support

If you encounter any issues:
1. Check the backend console for error messages
2. Verify all environment variables are set correctly
3. Ensure database connection is working
4. Check that all migrations have been run
