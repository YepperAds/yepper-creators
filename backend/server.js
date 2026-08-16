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
const hotDealsRoutes     = require('./routes/hotDealsRoutes');

// ─── AdPromoter routes ────────────────────────────────────────────────────────
const createWebsiteRoutes      = require('./AdPromoter/routes/createWebsiteRoutes');
const createCategoryRoutes     = require('./AdPromoter/routes/createCategoryRoutes');
const adDisplayRoutes          = require('./AdPromoter/routes/AdDisplayRoutes');
const businessCategoriesRoutes = require('./AdPromoter/routes/businessCategoriesRoutes');
const analyticsRoutes          = require('./AdPromoter/routes/analyticsRoutes');

// ─── AdOwner routes ───────────────────────────────────────────────────────────
const webAdvertiseRoutes = require('./AdOwner/routes/WebAdvertiseRoutes');

// Background jobs — requiring these runs their setInterval registration as a
// side effect (see the file itself for what it does).
require('./AdPromoter/utils/promoteGracePeriodAdSpaces');

// ─── Creators routes ──────────────────────────────────────────────────────────
const creatorsRouter                           = require('./creators/routes/creatorRoutes');
const { initCreatorsDatabase }                 = require('./creators/models/initDb');
const { refreshAllAdPostStats }                = require('./creators/controllers/creatorController');
const cron                                     = require('node-cron');

// ─────────────────────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Shared with creators/workerServer.js so both processes enforce the same
// origin allowlist instead of two copies drifting apart.
app.use(require('./config/cors'));

// ─── Session + Passport ───────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set.');
  process.exit(1);
}

app.use(session({
  secret: process.env.SESSION_SECRET,
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
app.use('/api/hot-deals',     hotDealsRoutes);

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
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File is too large. Please choose a smaller file and try again.';
    return res.status(400).json({ error: message, message });
  }
  const message = err.message || 'Internal Server Error';
  res.status(err.status || 500).json({ error: message, message });
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

  // Drop owner_id FK constraints that block creators from creating websites/ad-spaces
  try {
    const { up: dropOwnerFks } = require('./migrations/20260612_drop_owner_fk_constraints');
    await dropOwnerFks();
  } catch (err) {
    console.warn('⚠️  Migration 20260612_drop_owner_fk_constraints skipped:', err.message?.split('\n')[0]);
  }

  // Create pricing tables (pricing_rules + pricing_settings) if missing.
  try {
    const { up: createPricingTables } = require('./migrations/20260623_pricing_tables');
    await createPricingTables();
    console.log('✓ pricing tables ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260623_pricing_tables skipped:', err.message?.split('\n')[0]);
  }

  // Add business_categories/business_category_other to import_ads if missing.
  try {
    const { up: addBusinessCategories } = require('./migrations/20260627_add_business_categories_to_import_ads');
    await addBusinessCategories();
  } catch (err) {
    console.warn('⚠️  Migration 20260627_add_business_categories_to_import_ads skipped:', err.message?.split('\n')[0]);
  }

  // Create hot_deals/hot_deal_items tables if missing.
  try {
    const { up: createHotDeals } = require('./migrations/20260628_hot_deals');
    await createHotDeals();
    console.log('✓ hot deals tables ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260628_hot_deals skipped:', err.message?.split('\n')[0]);
  }

  // Create prospect-website support (is_prospect column + prospect_interests table) if missing.
  try {
    const { up: createProspectWebsites } = require('./migrations/20260705_prospect_websites');
    await createProspectWebsites();
    console.log('✓ prospect website tables ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260705_prospect_websites skipped:', err.message?.split('\n')[0]);
  }

  // Seed pricing_rules with the new video ad spaces (Preroll/Midroll/Pause) if missing.
  try {
    const { up: createVideoAdSpaces } = require('./migrations/20260705_video_ad_spaces');
    await createVideoAdSpaces();
    console.log('✓ video ad-space prices ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260705_video_ad_spaces skipped:', err.message?.split('\n')[0]);
  }

  // Add websites.pages + ad_categories.target_path for page-aware ad placement.
  try {
    const { up: addPagesAndTargetPath } = require('./migrations/20260728_website_pages_and_target_path');
    await addPagesAndTargetPath();
    console.log('✓ website pages / target_path ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260728_website_pages_and_target_path skipped:', err.message?.split('\n')[0]);
  }

  // Add ad_categories.detected_pages for real-placement page detection.
  try {
    const { up: addDetectedPages } = require('./migrations/20260730_ad_category_detected_pages');
    await addDetectedPages();
    console.log('✓ ad_categories.detected_pages ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260730_ad_category_detected_pages skipped:', err.message?.split('\n')[0]);
  }

  // Remove Google Search Console integration columns — traffic tier/pricing
  // runs purely off real script-tracked traffic now.
  try {
    const { up: dropGscColumns } = require('./migrations/20260807_drop_gsc_columns');
    await dropGscColumns();
    console.log('✓ gsc columns dropped');
  } catch (err) {
    console.warn('⚠️  Migration 20260807_drop_gsc_columns skipped:', err.message?.split('\n')[0]);
  }

  // Add ad_categories zone-detection columns + Right Rail/Footer pricing.
  try {
    const { up: addZoneDetection } = require('./migrations/20260815_ad_zone_detection');
    await addZoneDetection();
    console.log('✓ zone detection ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260815_ad_zone_detection skipped:', err.message?.split('\n')[0]);
  }

  // Preserve the ad space type/name an owner originally chose, separate
  // from what zone-detection reclassification later updates it to.
  try {
    const { up: addOriginalSpaceType } = require('./migrations/20260815b_ad_original_space_type');
    await addOriginalSpaceType();
    console.log('✓ original space type tracking ready');
  } catch (err) {
    console.warn('⚠️  Migration 20260815b_ad_original_space_type skipped:', err.message?.split('\n')[0]);
  }

  // Ad post stats are fetched live from YouTube on every getAdPosts call — no cron needed.

  function bindPort(port) {
    const server = app.listen(port, () => {
      console.log(`🚀 Unified Yepper backend running on port ${port}`);
      console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Auth routes : /api/auth/*`);
      console.log(`   AdPromoter  : /api/websites, /api/ads, /api/ad-categories, /api/analytics`);
      console.log(`   AdOwner     : /api/web-advertise/*`);
      console.log(`   Creators    : /auth/creator/google, /api/social/*, /api/website/*, /api/notifications/*`);
      if (port !== PORT) {
        console.log(`   ⚠  Port ${PORT} was busy — using ${port} instead. Update NEXT_PUBLIC_API_URL in frontend .env`);
      }
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`⚠  Port ${port} in use, trying ${port + 1}…`);
        bindPort(port + 1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  }

  bindPort(PORT);
}

startServer();

require('./keepAlive');
require('./AdPromoter/jobs/expireGrantWindows');
