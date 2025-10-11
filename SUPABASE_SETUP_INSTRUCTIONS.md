# 🎯 Complete Supabase Setup Guide

## Step 1: Get Your Supabase Connection Details

### Option A: Using Connection String (Easiest)
1. Open your Supabase dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click on your **hood-car-rentals** project
3. Go to **Settings** (gear icon) → **Database**
4. Scroll down to **Connection string** section
5. Select **Connection string** tab
6. Copy the URI (it looks like this):
   ```
   postgresql://postgres.abcdefg:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with your actual database password

### Option B: Using Individual Connection Details
From the same **Database Settings** page:
- **Host**: Found in "Connection info" → looks like `aws-0-us-west-1.pooler.supabase.com` OR `db.abcdefghijklmno.supabase.co`
- **Database name**: Usually `postgres`
- **Port**: `5432` (direct) or `6543` (connection pooler - recommended)
- **User**: `postgres`
- **Password**: The password you set when creating the project

## Step 2: Update Your `.env` File

Replace the placeholder values in your `.env` file:

```env
# PostgreSQL Database Credentials
DB_USER=postgres
DB_HOST=aws-0-us-west-1.pooler.supabase.com   # ← REPLACE THIS with your actual host
DB_DATABASE=postgres                            # Usually 'postgres'
DB_PASSWORD=your_actual_password_here           # ← REPLACE THIS with your password
DB_PORT=6543                                    # Use 6543 for pooler or 5432 for direct

# --- Resend API Key ---
RESEND_API_KEY="re_MmQXYgVJ_3CCzVtPD9XW5ntBDPkzuUc2f"

# Paystack Credentials
PAYSTACK_SECRET_KEY="sk_test_46e132f9b7985482997531653723d77ee383c6f9"
```

## Step 3: Create Database Tables in Supabase

1. In Supabase dashboard → **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy and paste the entire content from `reset-database.sql`
4. Click **Run** (or press F5)

You should see: "Success. No rows returned"

## Step 4: Verify Tables Were Created

In SQL Editor, run:
```sql
SELECT * FROM users;
SELECT * FROM testimonials;
SELECT * FROM bookings;
```

You should see empty tables (or sample testimonials if you included them).

## Step 5: Test Your Backend Connection

1. Save your `.env` file with the correct credentials
2. Restart your backend server
3. Test the connection:
   ```bash
   curl http://localhost:8000/testimonials
   ```

You should see an array of testimonials (might be empty `[]`).

## Step 6: Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your backend project
3. Go to **Settings** → **Environment Variables**
4. Add/Update these variables:
   ```
   DB_USER=postgres
   DB_HOST=your_supabase_host.supabase.com
   DB_DATABASE=postgres
   DB_PASSWORD=your_password
   DB_PORT=6543
   RESEND_API_KEY=re_MmQXYgVJ_3CCzVtPD9XW5ntBDPkzuUc2f
   PAYSTACK_SECRET_KEY=sk_test_46e132f9b7985482997531653723d77ee383c6f9
   ```
5. Click **Save**
6. Redeploy your backend

## 🔍 Troubleshooting

### Error: "getaddrinfo ENOTFOUND db.xxxx.supabase.co"
**Problem**: You haven't replaced the placeholder host
**Solution**: Update `DB_HOST` in `.env` with your actual Supabase host

### Error: "password authentication failed"
**Problem**: Wrong password or username
**Solution**:
- Verify password in Supabase Settings → Database
- Reset password if needed
- Make sure DB_USER is `postgres`

### Error: "relation 'users' does not exist"
**Problem**: Tables haven't been created yet
**Solution**: Run the `reset-database.sql` script in Supabase SQL Editor

### Connection works locally but not on Vercel
**Problem**: Environment variables not set in Vercel
**Solution**: Add all DB_* variables in Vercel project settings

## ✅ Quick Checklist

- [ ] Created Supabase project
- [ ] Got database connection details (host, password)
- [ ] Updated `.env` file with real credentials (not placeholders!)
- [ ] Ran `reset-database.sql` in Supabase SQL Editor
- [ ] Verified tables exist in Supabase
- [ ] Tested backend locally successfully
- [ ] Updated Vercel environment variables
- [ ] Redeployed backend to Vercel
- [ ] Tested production backend

## 🎉 You're Done!

Your database is now in the cloud and accessible from anywhere, including Vercel!
