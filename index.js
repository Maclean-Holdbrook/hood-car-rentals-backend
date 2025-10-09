import express from "express";
import pg from "pg";
import cors from "cors";
import bcrypt from "bcrypt";
import { Resend } from "resend"; // Keep Resend for email functionality
import https from "https";
import "dotenv/config"; // Load environment variables


// --- Environment Variable Validation ---
const requiredEnvVars = ['DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD', 'DB_PORT', 'RESEND_API_KEY', 'PAYSTACK_SECRET_KEY'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`FATAL ERROR: Environment variable ${varName} is not defined.`);
    console.error("Please ensure you have a .env file with all required variables.");
    process.exit(1); // Exit the application with an error code
  }
}
// ------------------------------------

const app = express();
const port = process.env.SERVER_PORT || 8000;
const saltRounds = 10;

// Instantiate Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Use a connection pool instead of a single client for better stability
const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// The pool will connect automatically on the first query

app.use(express.json());
app.use(express.urlencoded({extended:true}));

// CORS configuration for mobile testing and local development
app.use(cors({
  origin: [
    'http://localhost:5173',           // Local development server
    'http://192.168.0.196:5173',       // Mobile testing via IP
    'http://localhost:8000',           // Backend local
    'http://192.168.0.196:8000',       // Backend via IP
    'http://127.0.0.1:5173',           // Alternative localhost
    'http://127.0.0.1:8000'            // Alternative localhost backend
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
        res.status(200).json({ success: true, user: userResponse });
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

app.post("/send-booking-quote", async (req, res) => {
  const { car, bookingDetails, user: userPayload } = req.body;

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

    const totalAmount = (parseFloat(String(car.price).replace(/[^0-9.-]+/g,"")) * bookingDetails.numDays).toFixed(2);

    // --- Email Sending Logic ---
    const emailBodyHtml = `
      <h1>Your Car Rental Quote</h1>
      <p>Hello ${user.username || 'Valued Customer'},</p>
      <p>Thank you for your interest! Here is the quote for your requested booking:</p>
      
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
      <p>Thank you,<br>Hood Car Rentals</p>
    `;

    const mailOptions = {
      from: 'onboarding@resend.dev',
      // On Resend's free plan, you can only send to your own verified email.
      to: "macleaann723@gmail.com",
      subject: `Your Quote for ${car.title}`,
      html: emailBodyHtml,
    };

    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      // If the Resend service returns an error, throw it to the catch block
      throw error;
    }

    res.status(200).json({ success: true, message: "Booking quote sent successfully." });
  } catch (err) {
    console.error("Error sending booking quote:", err);
    res.status(500).json({ success: false, message: "Failed to send quote due to a server error.", error: err.message });
  }
});

app.post("/paystack/verify-payment", async (req, res) => {
  const { reference } = req.body;

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

          // Here you would save the booking to your database
          // e.g., await db.query('INSERT INTO bookings (customer_email, amount, reference) VALUES ($1, $2, $3)', [customer.email, amount, reference]);

          // Send a final confirmation email
          const emailBodyHtml = `
            <h1>Booking Confirmed!</h1>
            <p>Thank you, ${customer.first_name || 'Valued Customer'}! Your payment has been received and your booking is confirmed.</p>
            <h2>Receipt Details:</h2>
            <ul>
              <li><strong>Reference:</strong> ${reference}</li>
              <li><strong>Amount Paid:</strong> GHS ${(amount / 100).toFixed(2)}</li>
              <li><strong>Customer Email:</strong> ${customer.email}</li>
            </ul>
            <p>We will be in touch shortly with the final details of your car rental.</p>
          `;

          const mailOptions = {
            from: 'onboarding@resend.dev',
            // On Resend's free plan, you can only send to your own verified email.
            to: "macleaann723@gmail.com",
            subject: 'Your Car Rental Booking is Confirmed!',
            html: emailBodyHtml,
          };

          const { data, error } = await resend.emails.send(mailOptions);

          if (error) {
            // If Resend fails, we still consider the payment successful but log the email error.
            // The primary goal is to confirm payment status to the user.
            console.error("Payment was verified, but confirmation email failed to send:", error);
          }

          res.status(200).json({ success: true, message: "Payment verified and booking confirmed." });
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


// app.get("/test", (req, res) => res.json({ message: "API is working" }));

app.listen(port, () => {
  console.log(`Server running on:`);
  console.log(`  - Local:   http://localhost:${port}`);
  console.log(`  - Network: http://192.168.0.196:${port}`);
  console.log(`\nCORS enabled for mobile testing from IP: 192.168.0.196`);
});
