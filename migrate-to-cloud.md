# Migration Guide: Moving from Local PostgreSQL to Cloud Database

## 🎯 Recommended Solution: **Supabase** (Free PostgreSQL)

### Step 1: Create Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up with GitHub/Google
3. Create a new project
   - Choose a project name: `hood-car-rentals`
   - Generate a strong database password (save it!)
   - Select a region closest to you

### Step 2: Get Connection String
1. In Supabase dashboard → Settings → Database
2. Copy the **Connection String** (URI format)
3. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres`

### Step 3: Setup Database Schema
1. In Supabase → SQL Editor
2. Copy and paste the content from `reset-database.sql`
3. Click **Run** to create tables

### Step 4: Update Backend Environment Variables

**Local Development (.env):**
```env
# Supabase PostgreSQL Database
DB_USER=postgres
DB_HOST=db.xxxxxxxxxxxx.supabase.co
DB_DATABASE=postgres
DB_PASSWORD=your_supabase_password
DB_PORT=5432

# OR use connection string directly
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres

# Keep existing keys
RESEND_API_KEY=re_MmQXYgVJ_3CCzVtPD9XW5ntBDPkzuUc2f
PAYSTACK_SECRET_KEY=sk_test_46e132f9b7985482997531653723d77ee383c6f9
SERVER_PORT=8000
```

### Step 5: Update Vercel Environment Variables
1. Go to your Vercel project → Settings → Environment Variables
2. Add these variables:
   ```
   DB_USER=postgres
   DB_HOST=db.xxxxxxxxxxxx.supabase.co
   DB_DATABASE=postgres
   DB_PASSWORD=your_supabase_password
   DB_PORT=5432
   RESEND_API_KEY=re_MmQXYgVJ_3CCzVtPD9XW5ntBDPkzuUc2f
   PAYSTACK_SECRET_KEY=sk_test_46e132f9b7985482997531653723d77ee383c6f9
   ```

### Step 6: Test Connection
1. Run your backend locally: `npm start`
2. Test endpoints to verify database connection
3. Deploy to Vercel and test again

---

## 🔄 Alternative: **Railway** (Also Great!)

### Step 1: Create Railway Account
1. Go to [https://railway.app](https://railway.app)
2. Sign up with GitHub
3. New Project → Provision PostgreSQL

### Step 2: Get Credentials
1. Click on PostgreSQL service
2. Go to **Connect** tab
3. Copy connection details

### Step 3: Update Environment Variables
Use the Railway credentials in your `.env` and Vercel settings

---

## 🔄 Alternative: **ElephantSQL** (Simple & Free)

### Step 1: Create Account
1. Go to [https://elephantsql.com](https://elephantsql.com)
2. Sign up
3. Create New Instance → Tiny Turtle (Free)

### Step 2: Get Connection URL
1. Copy the **URL** from dashboard
2. Format: `postgres://username:password@host:port/database`

### Step 3: Parse and Use
```javascript
// You can use the full URL directly with pg
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for cloud databases
});
```

---

## 📋 Quick Commands

### Reset Local Database
```bash
# Using Node.js script
node reset-database.js

# Or manually with psql
psql -U postgres -d "Hood Car Rentals" -f reset-database.sql
```

### Backup Current Database (Before Reset)
```bash
pg_dump -U postgres "Hood Car Rentals" > backup.sql
```

### Restore from Backup
```bash
psql -U postgres "Hood Car Rentals" < backup.sql
```

---

## 🚀 Recommended Next Steps

1. **Choose a cloud provider** (Supabase recommended)
2. **Run the reset script** locally first to test
3. **Migrate to cloud database**
4. **Update Vercel environment variables**
5. **Test production deployment**

## ⚠️ Important Notes

- Always backup your data before resetting
- Update connection strings in both local `.env` and Vercel
- Most cloud databases require SSL: `ssl: { rejectUnauthorized: false }`
- Test thoroughly before going live
