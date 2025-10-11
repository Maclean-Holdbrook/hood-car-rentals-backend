# 🚨 DATABASE PASSWORD ISSUE

The error "Tenant or user not found" means the password is WRONG.

## ✅ SOLUTION: Get the Correct Password

### Option 1: Use the Connection String (RECOMMENDED)

1. In Supabase → Click **"Connect"** button
2. Scroll to **"Transaction pooler"** section
3. **COPY** the entire connection string shown (it looks like):
   ```
   postgresql://postgres.kanswmvhvwdtwyzgsnwf:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres
   ```
4. The password is the part after `:` and before `@`
5. Paste that EXACT password into your `.env` file

### Option 2: Reset Password to Something Simple

1. Go to Supabase → Settings → Database
2. Click **"Reset database password"**
3. Set password to something simple like: **`Test123456!`**
4. Copy that password
5. Wait 2-3 minutes for Supabase to process it
6. Update `.env` with: `DB_PASSWORD=Test123456!`
7. Restart the server

### Option 3: Check if Password Has Special Characters

The password `0c0fx1VpyAhw3cy9` might need to be URL-encoded if it has special characters when used in a connection string.

**Try wrapping the password in quotes in the `.env` file:**
```env
DB_PASSWORD="0c0fx1VpyAhw3cy9"
```

## 📋 Current Configuration

Your `.env` currently has:
```
DB_USER=postgres.kanswmvhvwdtwyzgsnwf
DB_HOST=aws-1-us-east-2.pooler.supabase.com
DB_DATABASE=postgres
DB_PASSWORD=0c0fx1VpyAhw3cy9
DB_PORT=6543
```

## 🧪 Test After Fixing

After updating the password, restart the server and test:
```bash
curl http://localhost:8000/testimonials
```

You should see JSON data with testimonials, not an error!

## ⚠️ Common Mistakes

- ❌ Using the API key instead of database password
- ❌ Using the project password instead of database password
- ❌ Not waiting for password reset to take effect (2-3 min)
- ❌ Typos when copying the password
- ❌ Using old/cached password

## 💡 Quick Test in Supabase

To verify your password works:
1. In Supabase → SQL Editor
2. Try running: `SELECT * FROM testimonials;`
3. If it works in Supabase, the password is correct and the issue is in `.env`
