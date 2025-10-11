# 🔍 How to Find Your Supabase Database Host

## Quick Steps:

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard

### 2. Select Your Project
Click on your **hood-car-rentals** project (or whatever name you gave it)

### 3. Go to Database Settings
Click on the **Settings** icon (⚙️) in the left sidebar → then click **Database**

### 4. Find Connection Info
Scroll down to the **Connection Info** or **Connection string** section

You'll see something like:

```
Connection parameters:
Host: aws-0-us-west-1.pooler.supabase.com
Database name: postgres
Port: 6543
User: postgres.abcdefghijklmno
```

OR

```
Connection string (URI):
postgresql://postgres.abcdefg:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

### 5. What to Copy

**Your DB_HOST should be one of these formats:**
- `aws-0-us-west-1.pooler.supabase.com` (connection pooler - **recommended**)
- `db.abcdefghijklmno.supabase.co` (direct connection)

**DO NOT include:**
- `postgresql://` prefix
- Port numbers (`:6543` or `:5432`)
- Your username or password
- Database name at the end

### 6. Example `.env` Configuration

If your host is `aws-0-us-west-1.pooler.supabase.com`:

```env
DB_USER=postgres
DB_HOST=aws-0-us-west-1.pooler.supabase.com
DB_DATABASE=postgres
DB_PASSWORD=your_actual_password_from_supabase
DB_PORT=6543
```

If your host is `db.abcdefghijklmno.supabase.co`:

```env
DB_USER=postgres
DB_HOST=db.abcdefghijklmno.supabase.co
DB_DATABASE=postgres
DB_PASSWORD=your_actual_password_from_supabase
DB_PORT=5432
```

## 🚨 Important Notes:

1. **Database Name**: Usually `postgres`, NOT `hood-car-rentals`
   - Change `DB_DATABASE=hood-car-rentals` to `DB_DATABASE=postgres`

2. **Port**:
   - Use `6543` if using pooler host (`aws-0-...pooler.supabase.com`)
   - Use `5432` if using direct host (`db.xyz.supabase.co`)

3. **Password**: Should be the password you set when creating the Supabase project
   - If you forgot it, you can reset it in Database Settings

## ✅ After Updating `.env`:

1. Save the file
2. Restart your backend server (it should auto-restart if nodemon is running)
3. Test the connection:
   ```bash
   curl http://localhost:8000/testimonials
   ```

If you see an empty array `[]` or testimonials data, **SUCCESS!** 🎉

If you still see errors, check the console output for specific error messages.
