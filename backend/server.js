'use strict';

const express      = require('express');
const cors         = require('cors');
const session      = require('express-session');
const passport     = require('passport');
const cookieParser = require('cookie-parser');

require('dotenv').config();
require('./config/passport');

const { pool } = require('./config/db');

// ─── Shared routes ────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/authRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const aiRoutes           = require('./routes/aiRoutes');
const passwordRoutes     = require('./routes/passwordRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const campaignRoutes     = require('./routes/campaignRoutes');
const webhookRoutes      = require('./routes/webhookRoutes');

// ─── AdPromoter routes ────────────────────────────────────────────────────────
const createWebsiteRoutes      = require('./AdPromoter/routes/createWebsiteRoutes');
const createCategoryRoutes     = require('./AdPromoter/routes/createCategoryRoutes');
const adDisplayRoutes          = require('./AdPromoter/routes/AdDisplayRoutes');
const businessCategoriesRoutes = require('./AdPromoter/routes/businessCategoriesRoutes');
const analyticsRoutes          = require('./AdPromoter/routes/analyticsRoutes');

// ─── AdOwner routes ───────────────────────────────────────────────────────────
const webAdvertiseRoutes = require('./AdOwner/routes/WebAdvertiseRoutes');

// ─── Creators routes ──────────────────────────────────────────────────────────
const creatorsRouter              = require('./creators/routes/creatorRoutes');
const { initCreatorsDatabase }    = require('./creators/models/initDb');

// ─────────────────────────────────────────────────────────────────────────────
const app = express();

app.use(express.json());
app.use(cookieParser());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5000',
  'http://yepper.cc',
  'https://yepper.cc',
  'https://www.yepper.cc',
  'http://www.yepper.cc',
  'https://yepper-backend.onrender.com',
  'https://yep-strator.vercel.app',
  'http://yep-strator.vercel.app',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://yeffddfdper.vercel.app',
  'http://yeffddfdper.vercel.app',
];

const allowNullOriginPaths = [
  '/api/ads/display',
  '/api/ads/view',
  '/api/ads/click',
  '/api/ads/script',
  '/api/ad-categories/ads/customization',
  '/api/analytics/track',
  '/api/p/',
  '/api/c/',
];

const normalizeOrigin    = (origin) => (!origin ? null : origin.endsWith('/') ? origin.slice(0, -1) : origin);
const shouldAllowNull    = (path)   => allowNullOriginPaths.some((p) => path.startsWith(p));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin || origin === 'null') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, x-node-key, x-node-ref');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    return next();
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (shouldAllowNull(req.path)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    return next();
  }

  if (allowedOrigins.includes(normalizedOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, x-node-key, x-node-ref');
    res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    return next();
  }

  console.error('✗ Origin rejected:', origin);
  return res.status(403).json({ error: 'CORS Error', message: `CORS policy does not allow access from: ${origin}`, allowedOrigins });
});

// ─── Session + Passport ───────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));
app.use(passport.initialize());
app.use(passport.session());

// ─── Shared routes ────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/password',      passwordRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/campaigns',     campaignRoutes);
app.use('/api/webhooks',      webhookRoutes);

// ─── AdPromoter routes ────────────────────────────────────────────────────────
app.use('/api/websites',            createWebsiteRoutes);
app.use('/api/createWebsite',       createWebsiteRoutes);
app.use('/api/business-categories', businessCategoriesRoutes);
app.use('/api/ad-categories',       createCategoryRoutes);
app.use('/api/ads',                 adDisplayRoutes);
app.use('/api/analytics',           analyticsRoutes);
app.use('/api/p',                   adDisplayRoutes);
app.use('/api/c',                   createCategoryRoutes);

// ─── AdOwner routes ───────────────────────────────────────────────────────────
app.use('/api/web-advertise', webAdvertiseRoutes);

// ─── Creators routes ──────────────────────────────────────────────────────────
app.use('/', creatorsRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).json({
  status:      'ok',
  backend:     'unified',
  timestamp:   new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
}));

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', { message: err.message, url: req.url, method: req.method });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Cannot ${req.method} ${req.url}` });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ PostgreSQL connected');
      break;
    } catch (err) {
      retries--;
      console.error(`❌ PostgreSQL connection error: ${err.message} — retrying (${retries} left)...`);
      if (retries === 0) {
        console.error('❌ Could not connect after multiple attempts. Starting server anyway.');
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  await initCreatorsDatabase().catch((err) => {
    console.error('❌ Failed to initialise creators DB schema:', err.message);
  });

  app.listen(PORT, () => {
    console.log(`🚀 Unified Yepper backend running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Auth routes : /api/auth/*`);
    console.log(`   AdPromoter  : /api/websites, /api/ads, /api/ad-categories, /api/analytics`);
    console.log(`   AdOwner     : /api/web-advertise/*`);
    console.log(`   Creators    : /auth/creator/google, /api/social/*, /api/website/*, /api/notifications/*`);
  });
}

startServer();

require('./keepAlive');
require('./AdPromoter/jobs/expireGrantWindows');
