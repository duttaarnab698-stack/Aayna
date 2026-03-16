require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");
const twilio = require("twilio");

const app = express();
const PORT = Number(process.env.PORT || 5500);
const APP_ORIGIN = process.env.APP_ORIGIN || "*";

app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN === "*" ? "*" : APP_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// In-memory OTP store: restart করলে reset হবে।
const otpStore = new Map();
const paymentOrderStore = new Map();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
const isIndianPhone = (value) => /^\+91\d{10}$/.test((value || "").trim());
const isPlaceholderValue = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  return (
    !raw ||
    raw.includes("your-email@example.com") ||
    raw.includes("your-email-password-or-app-password") ||
    raw.includes("xxxxxxxx")
  );
};

function parseIdentifier(identifier) {
  const raw = (identifier || "").trim();
  if (!raw) return { ok: false, reason: "missing" };
  if (raw.includes("@")) {
    if (!isValidEmail(raw)) return { ok: false, reason: "invalid_email" };
    return { ok: true, channel: "email", value: raw.toLowerCase() };
  }
  if (!isIndianPhone(raw)) return { ok: false, reason: "invalid_phone" };
  return { ok: true, channel: "phone", value: raw };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskIdentifier(identifier) {
  if (identifier.includes("@")) {
    const [name, domain] = identifier.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${identifier.slice(0, 3)}******${identifier.slice(-4)}`;
}

const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
const twilioClient = hasTwilio ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

const hasSMTP = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  !isPlaceholderValue(process.env.SMTP_USER) &&
  !isPlaceholderValue(process.env.SMTP_PASS)
);
const smtpFromAddress = !isPlaceholderValue(process.env.SMTP_FROM) ? process.env.SMTP_FROM : process.env.SMTP_USER;
const mailTransporter = hasSMTP
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const hasRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const razorpayClient = hasRazorpay
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

app.get("/api/otp/health", (req, res) => {
  res.json({
    ok: true,
    smsConfigured: hasTwilio,
    emailConfigured: hasSMTP
  });
});

app.post("/api/otp/send", async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body?.identifier);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, message: "Invalid identifier. Use email or +91 phone." });
    }

    const existing = otpStore.get(parsed.value);
    if (existing && Date.now() - existing.sentAt < OTP_RESEND_MS) {
      return res.status(429).json({ ok: false, message: "Please wait 30 seconds before requesting OTP again." });
    }

    const otp = generateOtp();
    otpStore.set(parsed.value, {
      otp,
      channel: parsed.channel,
      sentAt: Date.now(),
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0
    });

    if (parsed.channel === "phone") {
      if (!twilioClient) {
        return res.status(500).json({ ok: false, message: "SMS provider is not configured." });
      }

      await twilioClient.messages.create({
        body: `Your AAYNA OTP is ${otp}. Valid for 5 minutes.`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: parsed.value
      });
    } else {
      if (!mailTransporter) {
        return res.status(500).json({ ok: false, message: "Email provider is not configured." });
      }

      await mailTransporter.sendMail({
        from: smtpFromAddress,
        to: parsed.value,
        subject: "Your AAYNA OTP",
        text: `Your AAYNA OTP is ${otp}. It is valid for 5 minutes.`,
        html: `<p>Your AAYNA OTP is <strong>${otp}</strong>.</p><p>It is valid for 5 minutes.</p>`
      });
    }

    return res.json({
      ok: true,
      message: `OTP sent to ${maskIdentifier(parsed.value)}`
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to send OTP. Please try again.",
      error: error?.message || "Unknown error"
    });
  }
});

app.post("/api/otp/verify", (req, res) => {
  const parsed = parseIdentifier(req.body?.identifier);
  const otpInput = String(req.body?.otp || "").trim();
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, message: "Invalid identifier." });
  }
  if (!/^\d{6}$/.test(otpInput)) {
    return res.status(400).json({ ok: false, message: "OTP must be 6 digits." });
  }

  const record = otpStore.get(parsed.value);
  if (!record) return res.status(400).json({ ok: false, message: "Please send OTP first." });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(parsed.value);
    return res.status(400).json({ ok: false, message: "OTP expired. Request a new OTP." });
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(parsed.value);
    return res.status(429).json({ ok: false, message: "Too many attempts. Request OTP again." });
  }
  if (record.otp !== otpInput) {
    record.attempts += 1;
    otpStore.set(parsed.value, record);
    return res.status(400).json({ ok: false, message: "Invalid OTP." });
  }

  otpStore.delete(parsed.value);
  return res.json({ ok: true, message: "OTP verified." });
});

app.post("/api/payments/order", async (req, res) => {
  try {
    if (!razorpayClient || !hasRazorpay) {
      return res.status(500).json({ ok: false, message: "Razorpay is not configured on server." });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "Project Booking").trim();
    const amount = Number(req.body?.amount || 0);

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Valid email is required." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid amount." });
    }

    const amountPaise = Math.round(amount * 100);
    const year = new Date().getFullYear();
    const bookingId = `AAYNA-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const receipt = `aayna_${Date.now()}`;

    const order = await razorpayClient.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        bookingId,
        purpose,
        email
      }
    });

    paymentOrderStore.set(order.id, {
      bookingId,
      email,
      purpose,
      amount,
      createdAt: Date.now()
    });

    return res.json({
      ok: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      order
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to create Razorpay order.",
      error: error?.message || "Unknown error"
    });
  }
});

app.post("/api/payments/verify", (req, res) => {
  try {
    if (!hasRazorpay) {
      return res.status(500).json({ ok: false, message: "Razorpay is not configured on server." });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "Project Booking").trim();
    const amount = Number(req.body?.amount || 0);
    const orderId = String(req.body?.razorpay_order_id || "").trim();
    const paymentId = String(req.body?.razorpay_payment_id || "").trim();
    const signature = String(req.body?.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ ok: false, message: "Missing Razorpay payment fields." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Valid email is required." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid amount." });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      return res.status(400).json({ ok: false, message: "Payment signature verification failed." });
    }

    const orderMeta = paymentOrderStore.get(orderId);
    const bookingId = orderMeta?.bookingId || `AAYNA-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    paymentOrderStore.delete(orderId);

    return res.json({
      ok: true,
      booking: {
        bookingId,
        email,
        purpose: orderMeta?.purpose || purpose,
        amount: orderMeta?.amount || amount,
        appName: "Razorpay",
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to verify Razorpay payment.",
      error: error?.message || "Unknown error"
    });
  }
});

app.post("/api/bookings/confirm", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const bookingId = String(req.body?.bookingId || "").trim();
    const purpose = String(req.body?.purpose || "Project Booking").trim();
    const paymentMethod = String(req.body?.paymentMethod || "Payment").trim();
    const amount = Number(req.body?.amount || 0);

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Valid email is required." });
    }
    if (!bookingId) {
      return res.status(400).json({ ok: false, message: "Booking ID is required." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid amount." });
    }
    if (!mailTransporter || !hasSMTP) {
      return res.status(500).json({ ok: false, message: "Email provider is not configured on server." });
    }

    await mailTransporter.sendMail({
      from: smtpFromAddress,
      to: email,
      subject: `AAYNA Booking Confirmed - ${bookingId}`,
      text: [
        "Your Project Slot is Reserved.",
        `Booking ID: ${bookingId}`,
        `Purpose: ${purpose}`,
        `Amount: INR ${amount.toFixed(2)}`,
        `Payment Method: ${paymentMethod}`,
        "",
        "Thank you for booking with AAYNA Studio."
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#102030;">
          <h2 style="margin-bottom:8px;">Your Project Slot is Reserved</h2>
          <p style="margin:0 0 10px 0;">Booking details:</p>
          <ul style="padding-left:18px; margin-top:0;">
            <li><strong>Booking ID:</strong> ${bookingId}</li>
            <li><strong>Purpose:</strong> ${purpose}</li>
            <li><strong>Amount:</strong> INR ${amount.toFixed(2)}</li>
            <li><strong>Payment Method:</strong> ${paymentMethod}</li>
          </ul>
          <p style="margin-top:14px;">Thank you for booking with <strong>AAYNA Studio</strong>.</p>
        </div>
      `
    });

    return res.json({ ok: true, message: `Confirmation email sent to ${maskIdentifier(email)}` });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to send booking confirmation email.",
      error: error?.message || "Unknown error"
    });
  }
});

app.post("/api/mail/test", async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim().toLowerCase();
    if (!isValidEmail(to)) {
      return res.status(400).json({ ok: false, message: "Valid recipient email is required." });
    }
    if (!mailTransporter || !hasSMTP) {
      return res.status(500).json({ ok: false, message: "SMTP is not configured with real credentials." });
    }

    await mailTransporter.sendMail({
      from: smtpFromAddress,
      to,
      subject: "AAYNA SMTP Test Email",
      text: "If you received this, your SMTP configuration is working.",
      html: "<p>If you received this, your SMTP configuration is <strong>working</strong>.</p>"
    });

    return res.json({ ok: true, message: `Test email sent to ${maskIdentifier(to)}` });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to send test email.",
      error: error?.message || "Unknown error"
    });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (record.expiresAt <= now) otpStore.delete(key);
  }
  for (const [orderId, data] of paymentOrderStore.entries()) {
    if (data.createdAt + (30 * 60 * 1000) <= now) paymentOrderStore.delete(orderId);
  }
}, 60 * 1000);

app.use(express.static("."));

app.listen(PORT, () => {
  console.log(`AAYNA server running on http://localhost:${PORT}`);
});
