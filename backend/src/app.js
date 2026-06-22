const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');
const { mongoSanitize } = require('./middleware/security');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leadRoutes = require('./routes/lead.routes');
const reportRoutes = require('./routes/report.routes');
const activityRoutes = require('./routes/activity.routes');
const distributorRoutes = require('./routes/distributor.routes');

const app = express();

// We sit behind Vercel's proxy — trust exactly ONE hop so req.ip is the real
// client IP (from X-Forwarded-For) for rate limiting, not the proxy. (Using a
// fixed hop count, not `true`, so a client can't spoof its way past the limiter.)
app.set('trust proxy', 1);

// Don't advertise the server framework (one less hint for an attacker).
app.disable('x-powered-by');

// Secure HTTP response headers (clickjacking, MIME-sniffing, referrer, etc.).
// This is a JSON API, not an HTML site, so the CSP/COEP page-protections add no
// value here and can interfere with cross-origin API calls — keep those off.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// --- Core middleware ---
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize); // strip $-operators / dotted keys from all user input
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// --- Health check (no DB required) ---
app.get('/', (req, res) => {
  res.json({ name: 'Nexton Lubricants CRM API', status: 'ok' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Rate limiting (abuse / brute-force / DDoS guard) ---
// Per client IP. On serverless the in-memory counter is per warm instance, so it
// is a useful extra layer on top of the DB-backed per-account login lockout — not
// the only defence. Limits are generous so a shared office IP with several reps
// is never throttled during normal work; only a runaway script trips them.
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // ~200 req/min per IP — way above real use, blocks floods
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bahut zyada requests aa rahi hain — thodi der baad try karo.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 login attempts / 15 min per IP (complements the per-account lock)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bahut baar login try hua — thodi der baad try karo.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// Ensure a DB connection exists before handling any data request below.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/distributors', distributorRoutes);

// --- Errors ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
