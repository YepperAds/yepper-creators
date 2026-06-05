import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import crypto from 'crypto';
import dns from 'dns/promises';
import { readFileSync } from 'fs';
import { query } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || FRONTEND_ORIGIN;

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

function normalizeWebsiteUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    url.hash = '';
    url.search = '';
    const domain = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (!domain || !domain.includes('.')) return null;
    return {
      url: url.toString().replace(/\/$/, ''),
      domain,
    };
  } catch {
    return null;
  }
}

function websiteVerificationRecords(domain, token) {
  return {
    method: 'TXT',
    txtHost: '_yepper',
    txtLookupHost: `_yepper.${domain}`,
    txtValue: `yepper-site-verification=${token}`,
  };
}

async function checkWebsiteExists(url) {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (response.ok) return true;
    response = await fetch(url, { method: 'GET', redirect: 'follow' });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkDnsOwnership(domain, token) {
  const records = websiteVerificationRecords(domain, token);

  try {
    const txtRecords = await dns.resolveTxt(records.txtLookupHost);
    const flattened = txtRecords.map((parts) => parts.join(''));
    if (flattened.includes(records.txtValue)) {
      return { verified: true, method: 'TXT' };
    }
  } catch {}

  return { verified: false, method: null };
}

function secondsToDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return null;
  const totalSeconds = Math.max(0, Math.floor(Number(seconds)));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function hashValue(value) {
  return crypto
    .createHash('sha256')
    .update(`${value || 'unknown'}:${process.env.TRACKING_HASH_SALT || 'yepper-local-salt'}`)
    .digest('hex');
}

function scriptEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function emptyFirstPartyTraffic(domain, message = 'Install the Yepper tracking script to start collecting traffic.') {
  return {
    provider: 'yepper_first_party',
    domain,
    status: 'available',
    monthly_visits: 0,
    top_country: null,
    bounce_rate: 0,
    avg_visit_duration: '00:00:00',
    pages_per_visit: 0,
    unique_visitors: 0,
    checked_at: new Date().toISOString(),
    message,
  };
}

function domainSeed(domain) {
  const digest = crypto.createHash('sha256').update(domain).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

async function estimateWebsiteTraffic(domain) {
  const seed = domainSeed(domain);
  const estimatedVisits = Math.round(300 + seed * 12000);
  const bounceRate = Number((28 + seed * 30).toFixed(1));
  const avgDuration = 75 + Math.round(seed * 165);

  return {
    provider: 'yepper_estimator',
    domain,
    status: 'estimated',
    mode: 'estimated',
    monthly_visits: estimatedVisits,
    top_country: null,
    bounce_rate: bounceRate,
    avg_visit_duration: secondsToDuration(avgDuration),
    pages_per_visit: Number((1.3 + seed * 1.9).toFixed(2)),
    unique_visitors: Math.round(estimatedVisits * (0.62 + seed * 0.18)),
    confidence: 'low',
    checked_at: new Date().toISOString(),
    message: 'Estimated historical traffic from Yepper signals. Live tracking will replace this after 30 days.',
  };
}

function formatCountdown(targetDate) {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;

  const diff = target.getTime() - Date.now();
  if (diff <= 0) return '00d 00h 00m';

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

async function buildWebsiteTrafficSnapshot({ creatorId, domain, websiteStatus, websiteTraffic, actualStatsAvailableAt, forceActual = false }) {
  const actualReady = actualStatsAvailableAt && new Date(actualStatsAvailableAt).getTime() <= Date.now();
  const shouldUseActual = forceActual || actualReady;

  if (websiteStatus !== 'verified') {
    return websiteTraffic?.mode === 'actual'
      ? websiteTraffic
      : {
          ...emptyFirstPartyTraffic(domain),
          mode: 'estimated',
          next_update_at: actualStatsAvailableAt || null,
          countdown: actualStatsAvailableAt ? formatCountdown(actualStatsAvailableAt) : null,
        };
  }

  if (!shouldUseActual) {
    const estimate = websiteTraffic?.mode === 'estimated' ? websiteTraffic : await estimateWebsiteTraffic(domain);
    return {
      ...estimate,
      mode: 'estimated',
      next_update_at: actualStatsAvailableAt || null,
      countdown: actualStatsAvailableAt ? formatCountdown(actualStatsAvailableAt) : null,
    };
  }

  const actual = await summarizeWebsiteTraffic(creatorId, domain);
  return {
    ...actual,
    mode: 'actual',
    next_update_at: actualStatsAvailableAt || null,
    countdown: actualStatsAvailableAt ? formatCountdown(actualStatsAvailableAt) : null,
  };
}

async function summarizeWebsiteTraffic(creatorId, domain) {
  const result = await query(
    `
      WITH events AS (
        SELECT *
        FROM website_traffic_events
        WHERE creator_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
      ),
      sessions AS (
        SELECT
          session_id,
          COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
          MAX(duration_seconds) AS duration_seconds,
          MAX(country) FILTER (WHERE country IS NOT NULL AND country != '') AS country
        FROM events
        GROUP BY session_id
      ),
      top_country AS (
        SELECT country
        FROM sessions
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
      SELECT
        COUNT(*)::int AS monthly_visits,
        COALESCE(SUM(pageviews), 0)::int AS pageviews,
        COUNT(*) FILTER (WHERE pageviews = 1)::int AS bounced_visits,
        COALESCE(AVG(NULLIF(duration_seconds, 0)), 0)::float AS avg_duration_seconds,
        (SELECT country FROM top_country) AS top_country,
        (
          SELECT COUNT(DISTINCT visitor_hash)::int
          FROM events
          WHERE visitor_hash IS NOT NULL
        ) AS unique_visitors
      FROM sessions;
    `,
    [creatorId],
  );

  const row = result.rows[0] || {};
  const monthlyVisits = Number(row.monthly_visits || 0);
  const pageviews = Number(row.pageviews || 0);
  const bouncedVisits = Number(row.bounced_visits || 0);
  const avgDurationSeconds = Number(row.avg_duration_seconds || 0);

  return {
    provider: 'yepper_first_party',
    domain,
    status: 'available',
    monthly_visits: monthlyVisits,
    top_country: row.top_country || null,
    bounce_rate: monthlyVisits > 0 ? Number(((bouncedVisits / monthlyVisits) * 100).toFixed(1)) : 0,
    avg_visit_duration: secondsToDuration(avgDurationSeconds),
    pages_per_visit: monthlyVisits > 0 ? Number((pageviews / monthlyVisits).toFixed(2)) : 0,
    unique_visitors: Number(row.unique_visitors || 0),
    checked_at: new Date().toISOString(),
    message: monthlyVisits > 0 ? undefined : 'No tracked visits yet. Keep the Yepper script installed on your site.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Database initialisation — creators table
// ─────────────────────────────────────────────────────────────────────────────

async function initDatabase() {
  const schemaPath = new URL('../db/schema.sql', import.meta.url);
  const schemaStatements = readFileSync(schemaPath, 'utf8')
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of schemaStatements) {
    try {
      await query(statement);
    } catch (err) {
      console.warn('Skipping schema statement due to error:', err.message || err);
      // Continue with remaining statements to allow the server to start
      continue;
    }
  }

  await query(`
    CREATE TABLE IF NOT EXISTS creators (
      id                  SERIAL PRIMARY KEY,
      google_id           VARCHAR(255) UNIQUE NOT NULL,
      email               VARCHAR(255) UNIQUE NOT NULL,
      full_name           VARCHAR(255),
      avatar              TEXT,
      username            VARCHAR(50)  UNIQUE,
      what_they_do        VARCHAR(100),
      created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Fix: Ensure username and what_they_do are NULLABLE so initial login works
  await query(`ALTER TABLE creators ALTER COLUMN username DROP NOT NULL;`);
  await query(`ALTER TABLE creators ALTER COLUMN what_they_do DROP NOT NULL;`);
  
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS username     VARCHAR(50)  UNIQUE;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS what_they_do VARCHAR(100);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_name VARCHAR(255);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_url TEXT;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_domain VARCHAR(255);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_status VARCHAR(50) DEFAULT 'not_connected';`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_icon TEXT;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_token VARCHAR(255);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_method VARCHAR(20);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_host VARCHAR(255);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_value TEXT;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_traffic JSONB DEFAULT '{}';`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_tracking_token VARCHAR(255);`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_tracking_started_at TIMESTAMP WITH TIME ZONE;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_actual_stats_available_at TIMESTAMP WITH TIME ZONE;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verified_at TIMESTAMP WITH TIME ZONE;`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS creators_website_domain_unique
    ON creators (LOWER(website_domain))
    WHERE website_domain IS NOT NULL;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS website_traffic_events (
      id               BIGSERIAL PRIMARY KEY,
      creator_id       INTEGER REFERENCES creators(id) ON DELETE CASCADE,
      website_domain   VARCHAR(255) NOT NULL,
      tracking_token   VARCHAR(255) NOT NULL,
      session_id       VARCHAR(255) NOT NULL,
      visitor_hash     VARCHAR(255),
      event_type       VARCHAR(50) NOT NULL DEFAULT 'pageview',
      path             TEXT,
      referrer         TEXT,
      title            TEXT,
      user_agent       TEXT,
      country          VARCHAR(100),
      duration_seconds INTEGER DEFAULT 0,
      created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adsense_handoffs (
      id               BIGSERIAL PRIMARY KEY,
      creator_id       INTEGER REFERENCES creators(id) ON DELETE CASCADE,
      website_domain   VARCHAR(255),
      handoff_token    VARCHAR(255) UNIQUE NOT NULL,
      status           VARCHAR(30) DEFAULT 'active',
      created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      used_at          TIMESTAMP WITH TIME ZONE
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS website_traffic_events_creator_created_idx ON website_traffic_events (creator_id, created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS website_traffic_events_token_idx ON website_traffic_events (tracking_token);`);
  await query(`CREATE INDEX IF NOT EXISTS adsense_handoffs_token_idx ON adsense_handoffs (handoff_token);`);

  await query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id                   SERIAL PRIMARY KEY,
      google_id            VARCHAR(255) UNIQUE NOT NULL,
      email                VARCHAR(255) UNIQUE NOT NULL,
      full_name            VARCHAR(255),
      avatar               TEXT,
      business_name        VARCHAR(255),
      is_registered_entity BOOLEAN NOT NULL DEFAULT FALSE,
      location             VARCHAR(255),
      business_sector      VARCHAR(100),
      logo_url             TEXT,
      created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses (email);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_businesses_google_id ON businesses (google_id) WHERE google_id IS NOT NULL;`);

  await query(`
    CREATE TABLE IF NOT EXISTS sites (
      id         SERIAL PRIMARY KEY,
      site_key   VARCHAR(255) UNIQUE NOT NULL,
      owner_id   INTEGER REFERENCES creators(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_sites_owner_id ON sites (owner_id);`);

  await query(`
    CREATE TABLE IF NOT EXISTS visits (
      id           BIGSERIAL PRIMARY KEY,
      site_key     VARCHAR(255) NOT NULL,
      visitor_id   VARCHAR(255),
      page_url     TEXT,
      referrer     TEXT,
      user_agent   TEXT,
      ip           TEXT,
      event_type   VARCHAR(50) DEFAULT 'pageview',
      metadata     JSONB,
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_estimated BOOLEAN DEFAULT FALSE
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_visits_site_key ON visits(site_key);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);`);

  // Section: Connected Accounts Table
  await query(`
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id           SERIAL PRIMARY KEY,
      creator_id   INTEGER REFERENCES creators(id) ON DELETE CASCADE,
      provider     VARCHAR(50) NOT NULL, 
      provider_id  VARCHAR(255),
      username     VARCHAR(255),
      avatar       TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at   TIMESTAMP WITH TIME ZONE,
      stats        JSONB DEFAULT '{}',
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      social_id    TEXT,
      UNIQUE(creator_id, provider)
    );
  `);

  // Ensure column exists for those who already created the table
  await query(`ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS social_id TEXT;`);
  // Ensure social_id is UNIQUE across the whole platform per provider
  // (We skip adding the constraint here to avoid errors if it's already there, 
  // but the code logic handles the uniqueness check manually)
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta Webhook Verification (Required for Dashboard 'Verify & Save')
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/webhooks/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // This should match the 'Verify Token' you type in the Facebook Dashboard
  const VERIFY_TOKEN = 'yepper_secret_token_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

initDatabase().catch((error) => {
  console.error('Failed to initialize database schema:', error);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Yepper Creators backend is healthy.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth — initiation
// ─────────────────────────────────────────────────────────────────────────────

app.get('/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;

  if (!clientId) {
    return res.status(500).json({ success: false, message: 'Google OAuth client ID is not configured.' });
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('prompt', 'select_account');

  res.redirect(authUrl.toString());
});

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth — callback
// ─────────────────────────────────────────────────────────────────────────────

app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    console.log('Google callback received. code=', typeof code === 'string' ? code.slice(0, 8) + '...' : code);

    if (!code || typeof code !== 'string') {
      console.error('Missing Google code in callback. Query:', req.query);
      return res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
    }

    if (!clientId || !clientSecret) {
      console.error('Google client credentials are not configured.');
      return res.redirect(`${FRONTEND_URL}/login?error=google_config_missing`);
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;
    console.log('Using redirectUri', redirectUri);

    // Exchange auth code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenText = await tokenResponse.text();
    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', tokenResponse.status, tokenText);
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_token_response`);
    }

    const tokenData = JSON.parse(tokenText);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('Google token response missing access_token:', tokenData);
      return res.redirect(`${FRONTEND_URL}/login?error=missing_access_token`);
    }

    // Fetch Google profile
    const profileResponse = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken)}`,
    );

    const profileText = await profileResponse.text();
    if (!profileResponse.ok) {
      console.error('Google profile fetch failed:', profileResponse.status, profileText);
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_user_info`);
    }

    const profile = JSON.parse(profileText);
    const googleId = profile.sub;
    const email = profile.email;
    const fullName = profile.name ?? null;
    const avatar = profile.picture ?? null;

    if (!googleId || !email) {
      console.error('Google profile missing id/email:', profile);
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_google_profile`);
    }

    // Upsert into creators table
    const result = await query(
      `INSERT INTO creators (google_id, email, full_name, avatar, updated_at, created_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (google_id)
       DO UPDATE SET email      = EXCLUDED.email,
                     full_name  = EXCLUDED.full_name,
                     -- Only update avatar if user hasn't set their own yet (or if it was null)
                     avatar     = COALESCE(creators.avatar, EXCLUDED.avatar),
                     updated_at = NOW()
       RETURNING id, username, what_they_do;`,
      [googleId, email, fullName, avatar],
    );

    const row = result.rows[0];

    if (!row) {
      console.error('Database insert/update did not return a row.');
      return res.redirect(`${FRONTEND_URL}/login?error=database_error`);
    }

    console.log('Creator row after upsert:', row);

    // If onboarding not complete, send to /onboarding
    const needsOnboarding = !row.username || !row.what_they_do;
    const redirectPath = needsOnboarding ? '/onboarding' : '/explore';

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('yepper_session', String(row.id), {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    res.redirect(`${FRONTEND_URL}${redirectPath}`);
  } catch (error) {
    console.error('Unexpected error in Google callback:', error);
    return res.redirect(`${FRONTEND_URL}/login?error=callback_failure`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Session check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/auth/session', async (req, res) => {
  const session = req.cookies?.yepper_session;

  if (!session) {
    return res.json({ success: false, message: 'No session.' });
  }

  const result = await query(
    `SELECT id, google_id, email, full_name, avatar, username, what_they_do,
            website_name, website_url, website_domain, website_status,
            website_icon, website_traffic, website_tracking_started_at,
            website_actual_stats_available_at, website_verified_at
     FROM creators
     WHERE id = $1
     LIMIT 1;`,
    [session],
  );

  if (result.rowCount === 0) {
    return res.json({ success: false, message: 'Session not found.' });
  }

  const user = result.rows[0];

  return res.json({
    success: true,
    data: {
      user: {
        user_uuid:    String(user.id),
        id:           String(user.id),
        google_id:    user.google_id,
        fullname:     user.full_name ?? '',
        email:        user.email,
        username:     user.username ?? undefined,
        what_they_do: user.what_they_do ?? undefined,
        website: {
          name:        user.website_name ?? undefined,
          url:         user.website_url ?? undefined,
          domain:      user.website_domain ?? undefined,
          status:      user.website_status ?? 'not_connected',
          icon:        user.website_icon ?? undefined,
          traffic:     user.website_traffic ?? {},
          tracking_started_at: user.website_tracking_started_at ?? undefined,
          actual_stats_available_at: user.website_actual_stats_available_at ?? undefined,
          verified_at: user.website_verified_at ?? undefined,
        },
        avatar:       user.avatar ?? undefined,
        status:       'verified',
        role:         'creator',
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Username availability check  (real-time validator)
// GET /auth/check-username?username=xyz
// ─────────────────────────────────────────────────────────────────────────────

app.get('/auth/check-username', async (req, res) => {
  const raw = String(req.query.username ?? '').trim().toLowerCase();

  // Basic format validation
  if (!raw) {
    return res.json({ available: false, reason: 'Username is required.' });
  }
  if (raw.length < 3) {
    return res.json({ available: false, reason: 'Must be at least 3 characters.' });
  }
  if (raw.length > 50) {
    return res.json({ available: false, reason: 'Must be 50 characters or fewer.' });
  }
  if (!/^[a-z0-9_\.]+$/.test(raw)) {
    return res.json({ available: false, reason: 'Only letters, numbers, _ and . allowed.' });
  }
  if (/^[_\.]/.test(raw) || /[_\.]$/.test(raw)) {
    return res.json({ available: false, reason: 'Cannot start or end with _ or .' });
  }

  const result = await query(
    `SELECT 1 FROM creators WHERE username = $1 LIMIT 1;`,
    [raw],
  );

  if (result.rowCount > 0) {
    return res.json({ available: false, reason: 'Username is already taken.' });
  }

  return res.json({ available: true, reason: '' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

app.post('/auth/logout', (req, res) => {
  res.clearCookie('yepper_session', { path: '/' });
  return res.json({ success: true, message: 'Logged out.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Complete onboarding (set username + what_they_do)
// ─────────────────────────────────────────────────────────────────────────────

  app.post('/auth/update-profile', async (req, res) => {
    const session = req.cookies?.yepper_session;

    if (!session) {
      return res.status(401).json({ success: false, message: 'No active session.' });
    }

    const { username, what_they_do, avatar } = req.body;

    const normalizedUsername = String(username ?? '').trim().toLowerCase();
    const normalizedWhatTheyDo = String(what_they_do ?? '').trim();

    if (!normalizedUsername) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (normalizedWhatTheyDo && !['Content Creator', 'Web Developer', 'Graphic Designer'].includes(normalizedWhatTheyDo)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid creator category.' });
    }

    // Check if username is taken by another user
    const taken = await query(
      `SELECT 1 FROM creators WHERE username = $1 AND id != $2 LIMIT 1;`,
      [normalizedUsername, session],
    );
    if (taken.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    await query(
      `UPDATE creators
       SET username     = $1,
           what_they_do = $2,
           avatar       = $3,
           updated_at   = NOW()
       WHERE id = $4;`,
      [normalizedUsername, normalizedWhatTheyDo, avatar || null, session],
    );

    return res.json({ success: true, message: 'Profile updated successfully.' });
  });

  app.post('/auth/complete-registration', async (req, res) => {
  const session = req.cookies?.yepper_session;

  if (!session) {
    return res.status(401).json({ success: false, message: 'No active session.' });
  }

  const { username, what_they_do } = req.body;

  const normalizedUsername = String(username ?? '').trim().toLowerCase();
  const normalizedWhatTheyDo = String(what_they_do ?? '').trim();

  if (!normalizedUsername) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }
  if (!/^[a-z0-9_\.]+$/.test(normalizedUsername)) {
    return res.status(400).json({ success: false, message: 'Invalid username format.' });
  }
  if (!normalizedWhatTheyDo) {
    return res.status(400).json({ success: false, message: 'Please select what best describes you.' });
  }
  if (!['Content Creator', 'Web Developer', 'Graphic Designer'].includes(normalizedWhatTheyDo)) {
    return res.status(400).json({ success: false, message: 'Please choose a valid creator category.' });
  }

  // Re-check uniqueness at save time (race condition guard)
  const taken = await query(
    `SELECT 1 FROM creators WHERE username = $1 AND id != $2 LIMIT 1;`,
    [normalizedUsername, session],
  );
  if (taken.rowCount > 0) {
    return res.status(409).json({ success: false, message: 'Username is already taken. Please choose another.' });
  }

  await query(
    `UPDATE creators
     SET username     = $1,
         what_they_do = $2,
         updated_at   = NOW()
     WHERE id = $3;`,
    [normalizedUsername, normalizedWhatTheyDo, session],
  );

  return res.json({ success: true, data: { message: 'Onboarding completed.' } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Social Accounts — Connections & Stats
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/social/stats', async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false });

  const result = await query(
    `SELECT provider, username, avatar, stats FROM connected_accounts WHERE creator_id = $1`,
    [session]
  );

  const accounts = result.rows.map(acc => {
    const subs = acc.stats?.followers || 0;
    const views = acc.stats?.views || 0;
    const videoCount = acc.stats?.videoCount || 1; 

    const estReachPerVideo = Math.floor((subs * 0.10) + ((views / videoCount) * 0.05));
    const engagementIndex = subs > 0 ? ((views / (subs * 20)) * 5).toFixed(1) : "0.0";
    
    let ranking = 'Developing';
    if (acc.provider === 'youtube') {
      if (subs >= 100000) ranking = 'Perfect Spot';
      else if (subs >= 50000) ranking = 'Classic';
      else if (subs >= 10000) ranking = 'Business Recommended';
      else if (subs >= 5000) ranking = 'Recommended';
      else if (subs >= 1000) ranking = 'Normal Account';
      else ranking = 'Developing';
    } else {
      if (subs >= 1000000) ranking = 'Perfect Spot';
      else if (subs >= 100000) ranking = 'Jackpot';
      else if (subs >= 50000) ranking = 'Business Recommended';
      else if (subs >= 10000) ranking = 'Startup Recommended';
      else if (subs >= 5000) ranking = 'Normal Account';
      else ranking = 'Developing';
    }

    let aiInsight = "Syncing data to observe growth patterns...";
    if (subs > 0) {
      const viewVelocity = views / subs;
      if (viewVelocity > 50) {
        aiInsight = `Viral Potential: Your view velocity is ${viewVelocity.toFixed(0)}x your sub count. Advertisers crave this reach.`;
      } else if (viewVelocity > 10) {
        aiInsight = "Consistent Creator: Your content has a healthy re-watch value and maintains steady engagement.";
      } else {
        aiInsight = "Growing Base: Focus on high-retention content to increase your engagement index.";
      }
    }

    return {
      ...acc,
      followers: subs,
      views: views,
      analysis: {
        engagement_score: Math.min(parseFloat(String(engagementIndex)), 10).toFixed(1),
        predicted_reach: estReachPerVideo,
        predicted_likes: Math.floor(estReachPerVideo * 0.06),
        recommendation: ranking,
        total_views: views,
        ai_review: aiInsight,
        growth_trend: views > 1000 ? 'up' : 'steady'
      }
    };
  });

  return res.json({ success: true, data: accounts });
});

app.get('/api/social/video-stats', async (req, res) => {
  return res.json({ success: true, data: [] }); 
});

app.get('/api/website/tracker.js', async (req, res) => {
  // Website tracking script endpoint removed — respond with empty script
  res.type('application/javascript');
  return res.status(410).send('');
});

app.options('/api/website/collect', (req, res) => {
  return res.sendStatus(410);
});

app.use('/api/website/collect', express.text({ type: 'text/plain', limit: '20kb' }));

app.post('/api/website/collect', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Website tracking feature removed.' });
});

app.get('/api/website', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Website feature removed.' });
});

app.post('/api/website/start', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Website feature removed.' });
});

app.post('/api/website/verify', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Website feature removed.' });
});

app.post('/api/website/traffic/refresh', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Website feature removed.' });
});

app.delete('/api/website', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Website feature removed.' });
});

function normalizeHandoffIncludes(rawInclude) {
  const fallback = ['creator', 'website'];
  if (!rawInclude) return fallback;

  const allowed = new Set(['creator', 'profile', 'website', 'social_accounts', 'traffic', 'all']);
  const parsed = String(rawInclude)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry && allowed.has(entry));

  return parsed.length > 0 ? parsed : fallback;
}

async function buildHandoffData(creatorId, includes) {
  const includeAll = includes.includes('all');
  const includeSet = new Set(includes);
  const creatorResult = await query(
    `SELECT id, google_id, email, full_name, avatar, username, what_they_do,
            website_name, website_url, website_domain, website_status,
            website_icon, website_traffic, website_tracking_started_at,
            website_actual_stats_available_at, website_verified_at
     FROM creators
     WHERE id = $1
     LIMIT 1;`,
    [creatorId],
  );

  if (creatorResult.rowCount === 0) return null;

  const creator = creatorResult.rows[0];
  const data = {};

  if (includeAll || includeSet.has('creator') || includeSet.has('profile')) {
    data.creator = {
      id: String(creator.id),
      google_id: creator.google_id,
      email: creator.email,
      full_name: creator.full_name ?? '',
      avatar: creator.avatar ?? null,
      username: creator.username ?? '',
      what_they_do: creator.what_they_do ?? '',
    };
  }

  if (includeAll || includeSet.has('website') || includeSet.has('traffic')) {
    data.website = {
      name: creator.website_name ?? '',
      url: creator.website_url ?? '',
      domain: creator.website_domain ?? '',
      status: creator.website_status ?? 'not_connected',
      icon: creator.website_icon ?? null,
      traffic: creator.website_traffic ?? {},
      tracking_started_at: creator.website_tracking_started_at ?? null,
      actual_stats_available_at: creator.website_actual_stats_available_at ?? null,
      verified_at: creator.website_verified_at ?? null,
    };
  }

  if (includeAll || includeSet.has('social_accounts')) {
    const socialsResult = await query(
      `SELECT provider, username, avatar, stats, created_at
       FROM connected_accounts
       WHERE creator_id = $1
       ORDER BY created_at DESC;`,
      [creatorId],
    );

    data.social_accounts = socialsResult.rows.map((account) => ({
      provider: account.provider,
      username: account.username,
      avatar: account.avatar,
      stats: account.stats ?? {},
      created_at: account.created_at,
    }));
  }

  if (includeAll || includeSet.has('businesses')) {
    const businessResult = await query(
      `SELECT id, google_id, email, full_name, avatar, business_name, is_registered_entity,
              location, business_sector, logo_url, created_at, updated_at
       FROM businesses
       WHERE google_id = $1 OR email = $2
       ORDER BY created_at DESC;`,
      [creator.google_id, creator.email],
    );

    data.businesses = businessResult.rows;
  }

  if (includeAll || includeSet.has('sites') || includeSet.has('visits')) {
    const siteResult = await query(
      `SELECT id, site_key, owner_id, created_at
       FROM sites
       WHERE owner_id = $1
       ORDER BY created_at DESC;`,
      [creator.id],
    );

    data.sites = siteResult.rows;

    if (includeAll || includeSet.has('visits')) {
      const siteKeys = siteResult.rows.map((site) => site.site_key);
      if (siteKeys.length > 0) {
        const visitResult = await query(
          `SELECT id, site_key, visitor_id, page_url, referrer, user_agent, ip,
                  event_type, metadata, created_at, is_estimated
           FROM visits
           WHERE site_key = ANY($1::text[])
           ORDER BY created_at DESC
           LIMIT 200;`,
          [siteKeys],
        );
        data.visits = visitResult.rows;
      } else {
        data.visits = [];
      }
    }
  }

  return data;
}

app.post('/api/website/connect', async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const result = await query(
    `SELECT id, full_name, email, username, website_domain, website_status
     FROM creators
     WHERE id = $1
     LIMIT 1;`,
    [session],
  );

  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Creator not found.' });

  const creator = result.rows[0];

  const handoffToken = `website-${crypto.randomBytes(24).toString('hex')}`;
  await query(
    `INSERT INTO adsense_handoffs (creator_id, website_domain, handoff_token)
     VALUES ($1, $2, $3);`,
    [creator.id, creator.website_domain, handoffToken],
  );

  const handoffBase = process.env.THIRD_PARTY_WEBSITE_URL || process.env.ADSENSE_URL || `${FRONTEND_URL}/adsense`;
  return res.json({
    success: true,
    data: {
      handoff_token: handoffToken,
      handoff_url: `${handoffBase}?handoff=${encodeURIComponent(handoffToken)}`,
      creator: {
        id: String(creator.id),
        username: creator.username ?? '',
        full_name: creator.full_name ?? '',
        email: creator.email,
        website_domain: creator.website_domain,
      },
    },
  });
});

app.get('/api/handoff/:token/data', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ success: false, message: 'Token is required.' });
  const includes = normalizeHandoffIncludes(req.query.include || req.query.includes);

  const result = await query(
    `
      SELECT a.id, a.creator_id, a.website_domain, a.status, a.created_at, a.used_at,
             c.full_name, c.email, c.username, c.website_status, c.website_verified_at
      FROM adsense_handoffs a
      JOIN creators c ON c.id = a.creator_id
      WHERE a.handoff_token = $1
      LIMIT 1;
    `,
    [token],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Handoff token not found.' });
  }

  const handoff = result.rows[0];
  if (handoff.status !== 'active') {
    return res.status(410).json({ success: false, message: 'Handoff token is no longer active.' });
  }

  const data = await buildHandoffData(handoff.creator_id, includes);
  if (!data) {
    return res.status(404).json({ success: false, message: 'Creator data not found.' });
  }

  await query(
    `UPDATE adsense_handoffs
     SET used_at = COALESCE(used_at, NOW())
     WHERE handoff_token = $1;`,
    [token],
  );

  return res.json({
    success: true,
    data: {
      token,
      creator_id: String(handoff.creator_id),
      website_domain: handoff.website_domain,
      ...data,
      website: data.website || {
        status: handoff.website_status,
        verified_at: handoff.website_verified_at,
      },
      created_at: handoff.created_at,
      used_at: handoff.used_at,
    },
  });
});

app.post('/api/adsense/proceed', async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const result = await query(
    `SELECT id, full_name, email, username, website_domain, website_status
     FROM creators
     WHERE id = $1
     LIMIT 1;`,
    [session],
  );

  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Creator not found.' });

  const creator = result.rows[0];

  const handoffToken = `website-${crypto.randomBytes(24).toString('hex')}`;
  await query(
    `INSERT INTO adsense_handoffs (creator_id, website_domain, handoff_token)
     VALUES ($1, $2, $3);`,
    [creator.id, creator.website_domain, handoffToken],
  );

  const handoffBase = process.env.THIRD_PARTY_WEBSITE_URL || process.env.ADSENSE_URL || `${FRONTEND_URL}/adsense`;
  return res.json({
    success: true,
    data: {
      handoff_token: handoffToken,
      handoff_url: `${handoffBase}?handoff=${encodeURIComponent(handoffToken)}`,
      creator: {
        id: String(creator.id),
        username: creator.username ?? '',
        full_name: creator.full_name ?? '',
        email: creator.email,
        website_domain: creator.website_domain,
      },
    },
  });
});

app.get('/api/adsense/handoff/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ success: false, message: 'Token is required.' });

  const result = await query(
    `
      SELECT a.id, a.creator_id, a.website_domain, a.status, a.created_at, a.used_at,
             c.full_name, c.email, c.username, c.website_status, c.website_verified_at
      FROM adsense_handoffs a
      JOIN creators c ON c.id = a.creator_id
      WHERE a.handoff_token = $1
      LIMIT 1;
    `,
    [token],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Handoff token not found.' });
  }

  const handoff = result.rows[0];
  if (handoff.status !== 'active') {
    return res.status(410).json({ success: false, message: 'Handoff token is no longer active.' });
  }

  const data = await buildHandoffData(handoff.creator_id, ['all']);
  if (!data) {
    return res.status(404).json({ success: false, message: 'Creator data not found.' });
  }

  return res.json({
    success: true,
    data: {
      token,
      creator_id: String(handoff.creator_id),
      website_domain: handoff.website_domain,
      ...data,
      website: data.website || {
        status: handoff.website_status,
        verified_at: handoff.website_verified_at,
      },
      created_at: handoff.created_at,
      used_at: handoff.used_at,
    },
  });
});

app.get('/api/connect/:provider', (req, res) => {
  const { provider } = req.params;
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Unauthorized' });

  let clientId = '';
  let authBase = '';
  let scope = '';

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const redirectUri = `${backendUrl}/api/connect/${provider}/callback`;

  if (provider === 'youtube') {
    clientId = process.env.YOUTUBE_CLIENT_ID;
    authBase = 'https://accounts.google.com/o/oauth2/v2/auth';
    scope = 'https://www.googleapis.com/auth/youtube.readonly';
  } else if (provider === 'facebook') {
    clientId = process.env.META_CLIENT_ID;
    authBase = 'https://www.facebook.com/v18.0/dialog/oauth';
    scope = 'public_profile,email';
  } else if (provider === 'instagram') {
    clientId = process.env.META_CLIENT_ID;
    authBase = 'https://www.facebook.com/v18.0/dialog/oauth';
    scope = 'public_profile,email,instagram_basic,pages_show_list'; 
  }

  if (!clientId) return res.status(500).json({ success: false, message: `${provider} Client ID not configured` });

  const authUrl = new URL(authBase);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', session);

  return res.json({ success: true, url: authUrl.toString() });
});

app.get('/api/connect/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state: creator_id } = req.query;

  console.log(`[DEBUG] Received callback from ${provider}:`, { code: code ? 'YES' : 'NO', state: creator_id ? 'YES' : 'NO' });
  console.log('[DEBUG] Full Query:', req.query);

  if (!code) return res.status(400).send(`Missing authorization code from ${provider}.`);
  if (!creator_id) return res.status(400).send(`Missing security state (User ID) from ${provider}.`);

  try {
    let accessToken = '';
    let refreshToken = '';
    let socialId = '';
    let socialUser = 'Creator';
    let socialFollowers = 0;
    let socialAvatar = '';
    let socialViews = 0;
    let socialVideos = 0;

    if (provider === 'youtube') {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: process.env.YOUTUBE_CLIENT_ID || '',
          client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
          redirect_uri: `http://localhost:5000/api/connect/youtube/callback`,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Token exchange failed');
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;

      const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const channelData = await channelResponse.json();
      if (!channelResponse.ok || !channelData.items?.length) throw new Error('Could not fetch YouTube channel info.');

      const channel = channelData.items[0];
      socialId = channel.id;
      socialUser = channel.snippet.title;
      socialAvatar = channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url;
      socialFollowers = parseInt(channel.statistics.subscriberCount || '0');
      socialViews = parseInt(channel.statistics.viewCount || '0');
      socialVideos = parseInt(channel.statistics.videoCount || '0');

    } else if (provider === 'facebook' || provider === 'instagram') {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.META_CLIENT_ID}&redirect_uri=${backendUrl}/api/connect/${provider}/callback&client_secret=${process.env.META_CLIENT_SECRET}&code=${code}`);
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) throw new Error(tokenData.error?.message || 'Meta token exchange failed');
      accessToken = tokenData.access_token;

      if (provider === 'facebook') {
        const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=name,followers_count,fan_count,picture&access_token=${accessToken}`);
        const pagesData = await pagesRes.json();
        
        if (pagesData.data && pagesData.data.length > 0) {
          const page = pagesData.data[0];
          socialUser = page.name;
          socialFollowers = page.followers_count || page.fan_count || 0;
          socialAvatar = page.picture?.data?.url;
        } else {
          const meRes = await fetch(`https://graph.facebook.com/v18.0/me?fields=name,picture&access_token=${accessToken}`);
          const meData = await meRes.json();
          socialUser = meData.name;
          socialAvatar = meData.picture?.data?.url;
        }
      } else if (provider === 'instagram') {
        const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`);
        const pagesData = await pagesRes.json();
        const igAccountId = pagesData.data?.find(p => p.instagram_business_account)?.instagram_business_account?.id;
        
        if (igAccountId) {
          const igRes = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}?fields=username,profile_picture_url,followers_count&access_token=${accessToken}`);
          const igData = await igRes.json();
          socialId = igAccountId;
          socialUser = igData.username || 'IG Creator';
          socialAvatar = igData.profile_picture_url;
          socialFollowers = igData.followers_count || 0;
        } else {
          throw new Error('No Instagram Business Account linked to your Facebook Pages found.');
        }
      }
    }

    // 🛡️ SECURITY CHECK: Check if this Specific Social ID is already claimed by someone else
    const existingCheck = await query(
      `SELECT creator_id FROM connected_accounts WHERE provider = $1 AND social_id = $2`,
      [provider, socialId]
    );

    // FIX: Parse creator_id as integer to compare with DB integer
    const currentUserId = parseInt(creator_id);
    const linkedUserId = existingCheck.rows.length > 0 ? existingCheck.rows[0].creator_id : null;

    if (linkedUserId && linkedUserId !== currentUserId) {
      return res.status(403).send(`
        <div style="background: #000; color: #fff; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; padding: 20px;">
          <div style="text-align: center; border: 1px solid #E11D48; padding: 40px; border-radius: 20px; background: rgba(225, 29, 72, 0.05); border: 1px solid rgba(225, 29, 72, 0.2); max-width: 500px;">
            <div style="font-size: 50px; margin-bottom: 20px;">🛡️</div>
            <h2 style="color: #E11D48; margin-bottom: 10px;">Account Protected</h2>
            <p style="color: #ccc; line-height: 1.6;">This ${provider} account is already linked to another Yepper profile.</p>
            <p style="color: #888; font-size: 0.9em; margin-top: 20px;">If you own this account and want to move it to this profile, please disconnect it from the other profile first.</p>
            <button onclick="window.close()" style="margin-top: 30px; background: #333; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; transition: 0.2s;">Exit</button>
          </div>
        </div>
      `);
    }

    await query(
      `INSERT INTO connected_accounts (creator_id, provider, username, stats, avatar, access_token, refresh_token, social_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (creator_id, provider) DO UPDATE SET 
         stats = EXCLUDED.stats, 
         avatar = EXCLUDED.avatar,
         username = EXCLUDED.username,
         access_token = EXCLUDED.access_token,
         social_id = EXCLUDED.social_id,
         refresh_token = COALESCE(EXCLUDED.refresh_token, connected_accounts.refresh_token),
         updated_at = NOW()`,
      [creator_id, provider, socialUser, JSON.stringify({ followers: socialFollowers, views: socialViews, videoCount: socialVideos }), socialAvatar, accessToken, refreshToken, socialId]
    );

    res.send(`
      <html>
        <body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin:0;">
          <div style="text-align: center; background: #0F0F0F; padding: 40px; border-radius: 24px; border: 1px solid #333; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
            <h2 style="color: #22C55E; margin-bottom: 10px;">${provider.toUpperCase()} Connected!</h2>
            <p style="color: #888; font-size: 14px;">Your real stats are now live on Yepper.</p>
            <script>setTimeout(() => { window.close(); }, 2000);</script>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send(`Failed to connect account: ${err.message}`);
  }
});

app.post('/api/social/disconnect/:provider', async (req, res) => {
  const { provider } = req.params;
  const session = req.cookies?.yepper_session;

  if (!session) return res.status(401).json({ success: false });

  await query(
    `DELETE FROM connected_accounts WHERE creator_id = $1 AND provider = $2`,
    [session, provider]
  );

  return res.json({ success: true, message: 'Account disconnected.' });
});

app.listen(PORT, () => {
  console.log(`Yepper Creators backend listening on http://localhost:${PORT}`);
});
