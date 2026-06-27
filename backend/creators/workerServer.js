'use strict';

// Standalone entrypoint for the ad-video relay (upload to YouTube), deployed
// as its own Render service. server.js (the main API) loads express-session,
// passport, and a dozen unrelated route modules at boot; none of that is
// needed for postAdVideo / runAdVideoJob / getAdVideoJobStatus, which only
// ever use JWT-based auth (getCreatorId) and the shared Postgres
// ad_video_jobs table. Keeping this process lean leaves headroom for
// streaming large video uploads without competing with the main monolith.

const express      = require('express');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const cors = require('../config/cors');
const { pool } = require('../config/db');
const { initCreatorsDatabase } = require('./models/initDb');
const creatorsRouter = require('./routes/creatorRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(cors);

app.use('/', creatorsRouter);

app.get('/health', (req, res) => res.status(200).json({
  status:      'ok',
  backend:     'creators-worker',
  timestamp:   new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
}));

app.use((err, req, res, next) => {
  console.error('[worker] Error:', { message: err.message, url: req.url, method: req.method });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Cannot ${req.method} ${req.url}` });
});

// WORKER_PORT takes priority over PORT only to avoid a collision when
// running both processes locally off the same .env file (which already sets
// PORT for the main API). On Render, each service is its own container with
// its own injected PORT — no collision there, so PORT is still the right
// fallback in production.
const PORT = process.env.WORKER_PORT || process.env.PORT || 5050;

async function startWorker() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ [worker] PostgreSQL connected');
      break;
    } catch (err) {
      retries--;
      console.error(`❌ [worker] PostgreSQL connection error: ${err.message} — retrying (${retries} left)...`);
      if (retries === 0) {
        console.error('❌ [worker] Could not connect after multiple attempts. Starting anyway.');
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  await initCreatorsDatabase().catch((err) => {
    console.error('❌ [worker] Failed to initialise creators DB schema:', err.message);
  });

  app.listen(PORT, () => {
    console.log(`🚀 Ad-video worker running on port ${PORT}`);
  });
}

startWorker();
