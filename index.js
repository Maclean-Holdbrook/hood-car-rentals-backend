import express from "express";
import pg from "pg";
import cors from "cors";
import bcrypt from "bcrypt";
import { Resend } from "resend"; // Keep Resend for email functionality
import https from "https";
import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import "dotenv/config"; // Load environment variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// --- Environment Variable Validation ---
// Check if DATABASE_URL is provided (for serverless/production) or individual DB vars (for local dev)
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const hasIndividualDbVars = process.env.DB_USER && process.env.DB_HOST && process.env.DB_DATABASE && process.env.DB_PASSWORD && process.env.DB_PORT;

if (!hasDatabaseUrl && !hasIndividualDbVars) {
  console.error('FATAL ERROR: Database configuration missing.');
  console.error('Provide either DATABASE_URL or individual DB_* environment variables.');
  process.exit(1);
}

const requiredEnvVars = ['RESEND_API_KEY', 'PAYSTACK_SECRET_KEY'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`FATAL ERROR: Environment variable ${varName} is not defined.`);
    console.error("Please ensure you have a .env file with all required variables.");
    process.exit(1); // Exit the application with an error code
  }
}
// ------------------------------------

// Initialize Supabase client for storage (optional - only needed for production)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  console.log('✅ Supabase Storage initialized for cloud uploads');
} else {
  console.log('⚠️  Supabase credentials not found - using local storage only');
}

const app = express();
const port = process.env.SERVER_PORT || 8000;
const saltRounds = 10;

// Instantiate Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Use a connection pool instead of a single client for better stability
// Support both DATABASE_URL (serverless) and individual variables (local dev)
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
} : {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false, // Enable SSL for cloud databases
};

const db = new pg.Pool(dbConfig);

// The pool will connect automatically on the first query

app.use(express.json());
app.use(express.urlencoded({extended:true}));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
// Use memory storage for Supabase upload, or disk storage for local
const storage = supabase ? multer.memoryStorage() : multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/cars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'car-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// CORS configuration for local development, mobile testing, and production
app.use(cors({
  origin: [
    'http://localhost:5173',                        // Local development server
    'http://localhost:5174',                        // Local development server (alt port)
    'http://192.168.0.196:5173',                    // Mobile testing via IP
    'http://192.168.0.196:5174',                    // Mobile testing via IP (alt port)
    'http://localhost:8000',                        // Backend local
    'http://192.168.0.196:8000',                    // Backend via IP
    'http://127.0.0.1:5173',                        // Alternative localhost
    'http://127.0.0.1:5174',                        // Alternative localhost (alt port)
    'http://127.0.0.1:8000',                        // Alternative localhost backend
    'https://hood-car-rentals.vercel.app',          // Production frontend (Vercel)
    'https://hood-car-rentals-*.vercel.app'         // Preview deployments (Vercel)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Endpoint to handle testimonials submissions
app.post("/testimonials", async (req, res) => {
  const { name, rating, message } = req.body;
  try {
    await db.query(
      "INSERT INTO testimonials (name, rating, message) VALUES ($1, $2, $3)",
      [name, rating, message]
    );
    res.status(201).send("Testimonial submitted successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving testimonial.");
  }
});

// Endpoint to fetch all testimonials
app.get("/testimonials", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM testimonials ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching testimonials.");
  }
});

app.post("/signup", async (req, res) => {
  // Normalize and trim inputs for consistency
  const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
  const username = req.body.username ? req.body.username.trim().toLowerCase() : null;
  const password = req.body.password ? req.body.password.trim() : null;

  if (!email || !username || !password) {
    return res.status(400).json({ success: false, message: "Username, password, and email are required." });
  }

  try {
    // Check if username or email already exists in a single query
    const existingUserCheck = await db.query("SELECT username, email FROM users WHERE username = $1 OR email = $2", [
      username,
      email,
    ]);
    if (existingUserCheck.rows.length > 0) {
      const existingUser = existingUserCheck.rows[0];
      if (existingUser.username === username) {
        return res.status(409).json({ success: false, message: "Username already exists." });
      }
      if (existingUser.email === email) {
        return res.status(409).json({ success: false, message: "Email is already registered." });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await db.query(
      "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, hashedPassword, email]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  // Accept 'login', 'username', or 'email' as the login identifier
  const loginIdentifier = req.body.login || req.body.username || req.body.email;

  // Normalize and trim inputs
  const login = loginIdentifier ? loginIdentifier.trim().toLowerCase() : null;
  const password = req.body.password ? req.body.password.trim() : null;

  if (!login || !password) {
    return res.status(400).json({ success: false, message: "Login identifier and password are required." });
  }

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE username = $1 OR email = $1",
      [login] // Query with the normalized (lowercase) value
    );
    console.log(`Login attempt for: ${login}`);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log("User found in database.");
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        console.log("Password match successful.");
        const { password, ...userResponse } = user; // Omit password from response
        // Generate a simple token (in production, use JWT)
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
        res.status(200).json({ success: true, user: userResponse, token });
      } else {
        console.log("Password match failed.");
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } else {
      console.log("User not found in database.");
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Google OAuth authentication endpoint
app.post("/auth/google", async (req, res) => {
  const { credential, email: directEmail, name: directName, googleId } = req.body;

  // Support both old (credential) and new (direct user info) format
  let email, name;

  if (credential) {
    // Old format: Decode JWT credential from Google
    try {
      const base64Url = credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const googleUser = JSON.parse(jsonPayload);
      email = googleUser.email.toLowerCase();
      name = googleUser.name || googleUser.email.split('@')[0];
    } catch (err) {
      return res.status(400).json({ success: false, message: "Invalid Google credential." });
    }
  } else if (directEmail) {
    // New format: Direct user information
    email = directEmail.toLowerCase();
    name = directName || directEmail.split('@')[0];
  } else {
    return res.status(400).json({ success: false, message: "Google authentication data is required." });
  }

  try {

    // Check if user exists
    let result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    let user;
    if (result.rows.length > 0) {
      // User exists, log them in
      user = result.rows[0];
    } else {
      // Create new user
      const username = email.split('@')[0].toLowerCase() + '_' + Math.floor(Math.random() * 1000);
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      result = await db.query(
        "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email",
        [username, hashedPassword, email]
      );
      user = result.rows[0];
    }

    // Generate token
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    const { password, ...userResponse } = user;

    res.status(200).json({
      success: true,
      user: {
        ...userResponse,
        name: name
      },
      token
    });

  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ success: false, message: "Failed to authenticate with Google" });
  }
});

// Google OAuth code exchange endpoint (for redirect flow)
app.post("/auth/google/callback", async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: "Authorization code is required." });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ success: false, message: tokenData.error_description || 'Token exchange failed' });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    const email = userInfo.email.toLowerCase();
    const name = userInfo.name || userInfo.email.split('@')[0];

    // Check if user exists
    let result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    let user;
    if (result.rows.length > 0) {
      // User exists, log them in
      user = result.rows[0];
    } else {
      // Create new user
      const username = email.split('@')[0].toLowerCase() + '_' + Math.floor(Math.random() * 1000);
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      result = await db.query(
        "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email",
        [username, hashedPassword, email]
      );
      user = result.rows[0];
    }

    // Generate token
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    const { password, ...userResponse } = user;

    res.status(200).json({
      success: true,
      user: {
        ...userResponse,
        name: name
      },
      token
    });

  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.status(500).json({ success: false, message: "Failed to process Google authentication" });
  }
});

// ============= MAGIC LINK AUTHENTICATION =============

// Store for magic link tokens (in production, use Redis or database)
const magicLinkTokens = new Map();

// Store for OTP codes (in production, use Redis or database)
const otpCodes = new Map();

// Request magic link endpoint
app.post("/auth/magic-link/request", async (req, res) => {
  const email = req.body.email ? req.body.email.trim().toLowerCase() : null;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format." });
  }

  try {
    // Check if user exists, if not create one
    let result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    let user;
    let isNewUser = false;

    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      // Create new user with magic link
      const username = email.split('@')[0].toLowerCase() + '_' + Math.floor(Math.random() * 1000);
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      result = await db.query(
        "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email",
        [username, hashedPassword, email]
      );
      user = result.rows[0];
      isNewUser = true;
    }

    // Generate magic link token (valid for 15 minutes)
    const token = Buffer.from(`${user.id}:${Date.now()}:${Math.random()}`).toString('base64url');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store token
    magicLinkTokens.set(token, {
      userId: user.id,
      email: email,
      expiresAt: expiresAt
    });

    // Clean up expired tokens
    for (const [key, value] of magicLinkTokens.entries()) {
      if (value.expiresAt < Date.now()) {
        magicLinkTokens.delete(key);
      }
    }

    // Create magic link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const magicLink = `${frontendUrl}/auth/verify?token=${token}`;

    // Send email with magic link
    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome ${isNewUser ? 'to Hood Car Rentals' : 'back'}!</h1>
        <p style="font-size: 16px; color: #555;">
          ${isNewUser ? 'Thanks for signing up!' : 'You requested to log in to your account.'}
        </p>
        <p style="font-size: 16px; color: #555;">
          Click the button below to ${isNewUser ? 'verify your email and complete your registration' : 'log in to your account'}:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}"
             style="background-color: #007bff; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
            ${isNewUser ? 'Complete Registration' : 'Log In to Your Account'}
          </a>
        </div>
        <p style="font-size: 14px; color: #888;">
          Or copy and paste this link in your browser:<br>
          <a href="${magicLink}" style="color: #007bff;">${magicLink}</a>
        </p>
        <p style="font-size: 14px; color: #888;">
          This link will expire in 15 minutes.
        </p>
        <p style="font-size: 14px; color: #888;">
          If you didn't request this ${isNewUser ? 'registration' : 'login'}, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          Hood Car Rentals - Your trusted car rental service
        </p>
      </div>
    `;

    const mailOptions = {
      from: 'onboarding@resend.dev',
      to: email,
      subject: isNewUser ? 'Complete Your Registration - Hood Car Rentals' : 'Your Login Link - Hood Car Rentals',
      html: emailBodyHtml,
    };

    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      console.error("Failed to send magic link email:", error);
      return res.status(500).json({ success: false, message: "Failed to send magic link. Please try again." });
    }

    res.status(200).json({
      success: true,
      message: `Magic link sent to ${email}. Please check your inbox.`,
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (err) {
    console.error("Magic link request error:", err);
    res.status(500).json({ success: false, message: "Failed to process magic link request" });
  }
});

// Verify magic link token endpoint
app.post("/auth/magic-link/verify", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token is required." });
  }

  try {
    // Get token data
    const tokenData = magicLinkTokens.get(token);

    if (!tokenData) {
      return res.status(401).json({ success: false, message: "Invalid or expired magic link." });
    }

    // Check if token is expired
    if (tokenData.expiresAt < Date.now()) {
      magicLinkTokens.delete(token);
      return res.status(401).json({ success: false, message: "Magic link has expired. Please request a new one." });
    }

    // Get user
    const result = await db.query("SELECT * FROM users WHERE id = $1", [tokenData.userId]);

    if (result.rows.length === 0) {
      magicLinkTokens.delete(token);
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = result.rows[0];

    // Delete used token
    magicLinkTokens.delete(token);

    // Generate auth token
    const authToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    const { password, ...userResponse } = user;

    res.status(200).json({
      success: true,
      message: "Successfully authenticated!",
      user: userResponse,
      token: authToken
    });

  } catch (err) {
    console.error("Magic link verification error:", err);
    res.status(500).json({ success: false, message: "Failed to verify magic link" });
  }
});

// ============= EMAIL OTP AUTHENTICATION =============

// Request OTP code endpoint
app.post("/auth/otp/request", async (req, res) => {
  const email = req.body.email ? req.body.email.trim().toLowerCase() : null;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format." });
  }

  try {
    // Check if user exists, if not create one
    let result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    let user;
    let isNewUser = false;

    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      // Create new user with OTP
      const username = email.split('@')[0].toLowerCase() + '_' + Math.floor(Math.random() * 1000);
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      result = await db.query(
        "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email",
        [username, hashedPassword, email]
      );
      user = result.rows[0];
      isNewUser = true;
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpCodes.set(email, {
      code: otpCode,
      userId: user.id,
      expiresAt: expiresAt,
      attempts: 0
    });

    // Clean up expired OTPs
    for (const [key, value] of otpCodes.entries()) {
      if (value.expiresAt < Date.now()) {
        otpCodes.delete(key);
      }
    }

    // Send email with OTP code
    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; font-size: 28px; margin-bottom: 10px;">
            ${isNewUser ? 'Welcome to Hood Car Rentals!' : 'Welcome back!'}
          </h1>
          <p style="color: #666; font-size: 16px;">
            ${isNewUser ? 'Complete your registration with the code below' : 'Use the code below to log in to your account'}
          </p>
        </div>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
          <p style="color: white; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
            Your verification code
          </p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 15px 0;">
            <p style="font-size: 36px; font-weight: bold; color: #333; margin: 0; letter-spacing: 8px; font-family: monospace;">
              ${otpCode}
            </p>
          </div>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 15px;">
            This code expires in <strong>10 minutes</strong>
          </p>
        </div>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
            <strong>Security tips:</strong>
          </p>
          <ul style="color: #666; font-size: 14px; margin: 0; padding-left: 20px;">
            <li>Never share this code with anyone</li>
            <li>Hood Car Rentals will never ask for this code via phone or email</li>
            <li>If you didn't request this code, please ignore this email</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Hood Car Rentals - Your trusted car rental service
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: 'onboarding@resend.dev',
      to: email,
      subject: isNewUser ? 'Your Verification Code - Hood Car Rentals' : 'Your Login Code - Hood Car Rentals',
      html: emailBodyHtml,
    };

    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      console.error("Failed to send OTP email:", error);
      return res.status(500).json({ success: false, message: "Failed to send verification code. Please try again." });
    }

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${email}. Please check your inbox.`,
      expiresIn: 600 // 10 minutes in seconds
    });

  } catch (err) {
    console.error("OTP request error:", err);
    res.status(500).json({ success: false, message: "Failed to process OTP request" });
  }
});

// Verify OTP code endpoint
app.post("/auth/otp/verify", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: "Email and verification code are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  try {
    // Get OTP data
    const otpData = otpCodes.get(normalizedEmail);

    if (!otpData) {
      return res.status(401).json({ success: false, message: "Invalid or expired verification code." });
    }

    // Check if expired
    if (otpData.expiresAt < Date.now()) {
      otpCodes.delete(normalizedEmail);
      return res.status(401).json({ success: false, message: "Verification code has expired. Please request a new one." });
    }

    // Check attempts (max 5 attempts)
    if (otpData.attempts >= 5) {
      otpCodes.delete(normalizedEmail);
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new code." });
    }

    // Verify code
    if (otpData.code !== normalizedCode) {
      otpData.attempts++;
      return res.status(401).json({
        success: false,
        message: "Invalid verification code. Please try again.",
        attemptsRemaining: 5 - otpData.attempts
      });
    }

    // Code is valid - get user
    const result = await db.query("SELECT * FROM users WHERE id = $1", [otpData.userId]);

    if (result.rows.length === 0) {
      otpCodes.delete(normalizedEmail);
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = result.rows[0];

    // Delete used OTP
    otpCodes.delete(normalizedEmail);

    // Generate auth token
    const authToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    const { password, ...userResponse } = user;

    res.status(200).json({
      success: true,
      message: "Successfully authenticated!",
      user: userResponse,
      token: authToken
    });

  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({ success: false, message: "Failed to verify code" });
  }
});

app.post("/send-booking-quote", async (req, res) => {
  const { car, bookingDetails, user: userPayload, totalAmount: providedTotal, paymentStatus } = req.body;

  // --- Input Validation ---
  if (!car || !bookingDetails || !userPayload || typeof car !== 'object' || typeof bookingDetails !== 'object') {
    return res.status(400).json({ success: false, message: "Invalid request: Missing car, booking, or user details." });
  }

  // Normalize the user object in case it's sent as an array with one element
  const user = Array.isArray(userPayload) ? userPayload[0] : userPayload;

  if (typeof user !== 'object' || user === null) {
    return res.status(400).json({ success: false, message: "Invalid user data format." });
  }

  try {
    // Deeper validation
    if (!car.title || !car.price || !bookingDetails.startDate || !user.email || !bookingDetails.numDays) {
      throw new Error("Essential details like car title, price, start date, number of days, and user email are required.");
    }

    const totalAmount = providedTotal || (parseFloat(String(car.price).replace(/[^0-9.-]+/g,"")) * bookingDetails.numDays).toFixed(2);
    const pricePerDay = parseFloat(String(car.price).replace(/[^0-9.-]+/g,""));

    // Save booking to database
    const bookingResult = await db.query(
      `INSERT INTO bookings (
        user_id, user_name, user_email, car_id, car_title, car_price_per_day,
        region, city, area, start_date, end_date, num_days, total_amount, payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        user.id || null,
        user.username || user.name || 'N/A',
        user.email,
        car.id || null,
        car.title,
        pricePerDay,
        bookingDetails.selectedRegion,
        bookingDetails.selectedCity,
        bookingDetails.selectedArea,
        bookingDetails.startDate,
        bookingDetails.endDate,
        bookingDetails.numDays,
        totalAmount,
        paymentStatus || 'unpaid'
      ]
    );

    const bookingId = bookingResult.rows[0].id;

    // --- Email Sending Logic ---
    const emailBodyHtml = `
      <h1>Your Car Rental Quote</h1>
      <p>Hello ${user.username || user.name || 'Valued Customer'},</p>
      <p>Thank you for your interest! Here is the quote for your requested booking:</p>

      <h2>Booking ID: #${bookingId}</h2>

      <h2>Car Details</h2>
      <ul>
        <li><strong>Car:</strong> ${car.title}</li>
        <li><strong>Price per day:</strong> ${car.price}</li>
      </ul>

      <h2>Booking Preferences</h2>
      <ul>
        <li><strong>Region:</strong> ${bookingDetails.selectedRegion}</li>
        <li><strong>City:</strong> ${bookingDetails.selectedCity}</li>
        <li><strong>Area:</strong> ${bookingDetails.selectedArea}</li>
        <li><strong>Start Date:</strong> ${new Date(bookingDetails.startDate).toLocaleDateString()}</li>
        <li><strong>End Date:</strong> ${new Date(bookingDetails.endDate).toLocaleDateString()}</li>
        <li><strong>Number of Days:</strong> ${bookingDetails.numDays}</li>
      </ul>

      <h2>User Details (for admin)</h2>
     <ul>
        <li><strong>Email:</strong> ${user.email || 'N/A'}</li>
     </ul>

      <h2>Total Estimated Cost: GH¢${totalAmount}</h2>
      <h3>Payment Status: ${paymentStatus || 'Unpaid'}</h3>
      <p>Thank you,<br>Hood Car Rentals</p>
    `;

    const mailOptions = {
      from: 'onboarding@resend.dev',
      // On Resend's free plan, you can only send to your own verified email.
      to: "macleaann723@gmail.com",
      subject: `Booking #${bookingId} - ${car.title}`,
      html: emailBodyHtml,
    };

    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      // If email fails, still return success since booking was saved
      console.error("Booking saved but email failed:", error);
    }

    res.status(200).json({
      success: true,
      message: "Booking saved successfully.",
      bookingId: bookingId
    });
  } catch (err) {
    console.error("Error processing booking:", err);
    res.status(500).json({ success: false, message: "Failed to process booking due to a server error.", error: err.message });
  }
});

app.post("/paystack/verify-payment", async (req, res) => {
  const { reference, car, bookingDetails, user, totalAmount } = req.body;

  if (!reference) {
    return res.status(400).json({ success: false, message: "Payment reference is required for verification." });
  }

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: `/transaction/verify/${reference}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
    }
  };

  const verificationReq = https.request(options, (verificationRes) => {
    let data = '';
    verificationRes.on('data', (chunk) => { data += chunk; });
    verificationRes.on('end', async () => {
      try {
        const body = JSON.parse(data);
        if (body.status && body.data.status === 'success') {
          // PAYMENT IS VERIFIED
          console.log("Paystack verification successful:", body.data);
          const { customer, amount } = body.data;

          // Save booking to database with paid status
          let bookingId;
          if (car && bookingDetails && user) {
            const pricePerDay = parseFloat(String(car.price).replace(/[^0-9.-]+/g,""));

            const bookingResult = await db.query(
              `INSERT INTO bookings (
                user_id, user_name, user_email, car_id, car_title, car_price_per_day,
                region, city, area, start_date, end_date, num_days, total_amount,
                payment_status, payment_reference
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              RETURNING id`,
              [
                user.id || null,
                user.username || user.name || customer.first_name || 'N/A',
                user.email || customer.email,
                car.id || null,
                car.title,
                pricePerDay,
                bookingDetails.selectedRegion,
                bookingDetails.selectedCity,
                bookingDetails.selectedArea,
                bookingDetails.startDate,
                bookingDetails.endDate,
                bookingDetails.numDays,
                totalAmount || (amount / 100).toFixed(2),
                'paid',
                reference
              ]
            );

            bookingId = bookingResult.rows[0].id;
          }

          // Send a final confirmation email
          const emailBodyHtml = `
            <h1>Booking Confirmed!</h1>
            <p>Thank you, ${customer.first_name || user?.username || 'Valued Customer'}! Your payment has been received and your booking is confirmed.</p>
            ${bookingId ? `<h2>Booking ID: #${bookingId}</h2>` : ''}
            <h2>Receipt Details:</h2>
            <ul>
              <li><strong>Reference:</strong> ${reference}</li>
              <li><strong>Amount Paid:</strong> GHS ${(amount / 100).toFixed(2)}</li>
              <li><strong>Customer Email:</strong> ${customer.email}</li>
              ${car ? `<li><strong>Car:</strong> ${car.title}</li>` : ''}
              ${bookingDetails ? `<li><strong>Dates:</strong> ${new Date(bookingDetails.startDate).toLocaleDateString()} - ${new Date(bookingDetails.endDate).toLocaleDateString()}</li>` : ''}
            </ul>
            <p>We will be in touch shortly with the final details of your car rental.</p>
          `;

          const mailOptions = {
            from: 'onboarding@resend.dev',
            // On Resend's free plan, you can only send to your own verified email.
            to: "macleaann723@gmail.com",
            subject: bookingId ? `Booking #${bookingId} Confirmed - Payment Received` : 'Your Car Rental Booking is Confirmed!',
            html: emailBodyHtml,
          };

          const { data: emailData, error } = await resend.emails.send(mailOptions);

          if (error) {
            // If Resend fails, we still consider the payment successful but log the email error.
            // The primary goal is to confirm payment status to the user.
            console.error("Payment was verified, but confirmation email failed to send:", error);
          }

          res.status(200).json({
            success: true,
            message: "Payment verified and booking confirmed.",
            bookingId: bookingId
          });
        } else {
          // Payment verification failed
          res.status(400).json({ success: false, message: body.message || "Payment verification failed." });
        }
      } catch (error) {
        console.error("Error processing Paystack verification:", error);
        res.status(500).json({ success: false, message: "Internal server error during payment verification." });
      }
    });
  });

  verificationReq.on('error', (error) => {
    console.error("Error with Paystack verification request:", error);
    res.status(500).json({ success: false, message: "An error occurred while verifying the transaction." });
  });

  verificationReq.end();
});

// Diagnostic endpoint to test email configuration
app.get("/test-email", async (req, res) => {
  console.log("Attempting to send a test email...");

  const mailOptions = {
    from: 'onboarding@resend.dev', // Resend requires this 'from' address on the free plan
    to: "macleaann723@gmail.com", // Send it to yourself for testing
    subject: "Resend Test Email",
    text: "If you received this, your Resend configuration is working!",
    html: "<b>If you received this, your Resend configuration is working!</b>",
  };

  try {
    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      // The 'resend' library returns an error object on failure
      throw error;
    }

    console.log("Test email sent successfully:", data);
    res.status(200).json({
      success: true,
      message: "Test email sent successfully! Check your inbox.",
      info: data,
    });
  } catch (error) {
    console.error("Failed to send test email:", error);
    // Send the detailed error back in the response for easier debugging
    res.status(500).json({
      success: false,
      message: "Failed to send test email.",
      error: error, // Send the full error object from Resend
    });
  }
});
// Add this code to your main server file (e.g., index.js)

app.post("/support-message", async (req, res) => {
  const { name, email, subject, message } = req.body;

  // 1. Basic Validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "Name, email, subject, and message are all required." });
  }

  // 2. Construct Email Content
  const emailBodyHtml = `
    <h1>New Support Message</h1>
    <p>You have received a new message from your website's support form.</p>
    <h2>Sender Details:</h2>
    <ul>
      <li><strong>Name:</strong> ${name}</li>
      <li><strong>Email:</strong> ${email}</li>
    </ul>
    <h2>Message:</h2>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  const mailOptions = {
    from: 'onboarding@resend.dev', // Required by Resend on the free plan
    to: "macleaann723@gmail.com",   // Your support email address
    subject: `Support Form: ${subject}`,
    html: emailBodyHtml,
  };

  // 3. Send the Email
  try {
    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      // If the Resend service returns an error, throw it to the catch block
      throw error;
    }

    res.status(200).json({ success: true, message: "Message sent successfully!" });

  } catch (err) {
    console.error("Error sending support email:", err);
    res.status(500).json({ success: false, message: "Failed to send message due to a server error." });
  }
});

// ============= ADMIN ENDPOINTS =============

// Admin login endpoint
app.post("/admin/login", async (req, res) => {
  const username = req.body.username ? req.body.username.trim().toLowerCase() : null;
  const password = req.body.password ? req.body.password.trim() : null;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }

  try {
    // Check for admin credentials - you should create an admin user in your database
    const result = await db.query(
      "SELECT * FROM users WHERE username = $1 AND is_admin = true",
      [username]
    );

    if (result.rows.length > 0) {
      const admin = result.rows[0];
      const match = await bcrypt.compare(password, admin.password);

      if (match) {
        const { password, ...adminResponse } = admin;
        // In production, generate a proper JWT token
        const token = Buffer.from(`${admin.id}:${Date.now()}`).toString('base64');
        res.status(200).json({ success: true, user: adminResponse, token });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all users (admin only)
app.get("/admin/users", async (req, res) => {
  try {
    // In production, verify admin token here
    const result = await db.query("SELECT id, username, email, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// Delete user (admin only)
app.delete("/admin/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // In production, verify admin token here
    await db.query("DELETE FROM users WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting user" });
  }
});

// Delete testimonial (admin only)
app.delete("/admin/testimonials/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // In production, verify admin token here
    await db.query("DELETE FROM testimonials WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: "Testimonial deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting testimonial" });
  }
});

// Get all bookings (admin only)
app.get("/admin/bookings", async (req, res) => {
  try {
    // In production, verify admin token here
    const result = await db.query(`
      SELECT
        id,
        user_id,
        user_name,
        user_email,
        car_id,
        car_title,
        car_price_per_day,
        region,
        city,
        area,
        start_date,
        end_date,
        num_days,
        total_amount,
        payment_status,
        payment_reference,
        created_at,
        updated_at
      FROM bookings
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ success: false, message: "Error fetching bookings" });
  }
});

// Delete booking (admin only)
app.delete("/admin/bookings/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // In production, verify admin token here
    await db.query("DELETE FROM bookings WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting booking" });
  }
});

// ============= FILE UPLOAD ENDPOINT =============

// Diagnostic endpoint to check Supabase configuration
app.get("/supabase-status", (req, res) => {
  res.json({
    supabaseConfigured: !!supabase,
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_ANON_KEY,
    urlPrefix: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 20) + '...' : 'Not set',
    message: supabase ? 'Supabase Storage is configured' : 'Supabase Storage not configured - using local storage'
  });
});

// Upload car images (admin only)
app.post("/upload/car-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // If Supabase is configured, upload to Supabase Storage
    if (supabase) {
      const fileName = `car-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;

      const { data, error } = await supabase.storage
        .from('car-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ success: false, message: "Upload to cloud storage failed", error: error.message });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('car-images')
        .getPublicUrl(fileName);

      return res.status(200).json({
        success: true,
        imageUrl: publicUrl,
        filename: fileName
      });
    }

    // Fallback to local storage if Supabase not configured
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/cars/${req.file.filename}`;

    res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ success: false, message: "File upload failed", error: error.message });
  }
});

// Upload multiple car images (admin only)
app.post("/upload/car-images", upload.array('images', 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    // If Supabase is configured, upload to Supabase Storage
    if (supabase) {
      const uploadPromises = req.files.map(async (file) => {
        const fileName = `car-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;

        const { data, error } = await supabase.storage
          .from('car-images')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) {
          throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('car-images')
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);

      return res.status(200).json({
        success: true,
        imageUrls: imageUrls
      });
    }

    // Fallback to local storage if Supabase not configured
    const imageUrls = req.files.map(file =>
      `${req.protocol}://${req.get('host')}/uploads/cars/${file.filename}`
    );

    res.status(200).json({
      success: true,
      imageUrls: imageUrls
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ success: false, message: "File upload failed", error: error.message });
  }
});

// ============= CARS MANAGEMENT ENDPOINTS =============

// Get all cars
app.get("/cars", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM cars WHERE is_available = true ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching cars" });
  }
});

// Get all cars (admin - includes unavailable)
app.get("/admin/cars", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM cars ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching cars" });
  }
});

// Get single car
app.get("/cars/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM cars WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching car" });
  }
});

// Add new car (admin only)
app.post("/admin/cars", async (req, res) => {
  const { title, description, price_per_day, transmission, seats, has_ac, category, image_url, image_url_2, image_url_3, image_url_4, is_available } = req.body;

  // Validation
  if (!title || !description || !price_per_day) {
    return res.status(400).json({ success: false, message: "Title, description, and price are required" });
  }

  try {
    const result = await db.query(
      `INSERT INTO cars (title, description, price_per_day, transmission, seats, has_ac, category, image_url, image_url_2, image_url_3, image_url_4, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [title, description, price_per_day, transmission || 'Automatic', seats || 5, has_ac !== false, category || 'Sedan', image_url, image_url_2, image_url_3, image_url_4, is_available !== false]
    );
    res.status(201).json({ success: true, car: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error adding car" });
  }
});

// Update car (admin only)
app.put("/admin/cars/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, price_per_day, transmission, seats, has_ac, category, image_url, image_url_2, image_url_3, image_url_4, is_available } = req.body;

  try {
    const result = await db.query(
      `UPDATE cars
       SET title = $1, description = $2, price_per_day = $3, transmission = $4, seats = $5,
           has_ac = $6, category = $7, image_url = $8, image_url_2 = $9, image_url_3 = $10,
           image_url_4 = $11, is_available = $12
       WHERE id = $13
       RETURNING *`,
      [title, description, price_per_day, transmission, seats, has_ac, category, image_url, image_url_2, image_url_3, image_url_4, is_available, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }

    res.json({ success: true, car: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error updating car" });
  }
});

// Delete car (admin only)
app.delete("/admin/cars/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM cars WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: "Car deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting car" });
  }
});

// app.get("/test", (req, res) => res.json({ message: "API is working" }));

app.listen(port, () => {
  console.log(`Server running on:`);
  console.log(`  - Local:   http://localhost:${port}`);
  console.log(`  - Network: http://192.168.0.196:${port}`);
  console.log(`\nCORS enabled for mobile testing from IP: 192.168.0.196`);
});

