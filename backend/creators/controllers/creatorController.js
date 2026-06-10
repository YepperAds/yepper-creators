'use strict';

const crypto    = require('crypto');
const dns       = require('dns/promises');
const nodemailer = require('nodemailer');

const { query } = require('../../config/db');
const Creator   = require('../models/Creator');

// ─── SMTP (creators-specific mailer) ─────────────────────────────────────────

const FRONTEND_URL    = process.env.FRONTEND_URL    || process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || FRONTEND_URL;

const SMTP_HOST  = process.env.SMTP_HOST;
const SMTP_PORT  = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER  = process.env.SMTP_USER;
const SMTP_PASS  = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL ||
  `no-reply@${(FRONTEND_ORIGIN || 'localhost').replace(/^https?:\/\//, '')}`;

let mailer = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn('[creators] SMTP not configured — creator emails will be skipped.');
}

async function sendEmail(to, subject, html) {
  if (!mailer) {
    console.log(`[creators] Skipping email to ${to}: SMTP not configured.`);
    return false;
  }
  try {
    await mailer.sendMail({ from: FROM_EMAIL, to, subject, html });
    return true;
  } catch (err) {
    console.error('[creators] Failed to send email:', err);
    return false;
  }
}

// ─── Website helpers ──────────────────────────────────────────────────────────

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
    return { url: url.toString().replace(/\/$/, ''), domain };
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
    const flattened  = txtRecords.map((parts) => parts.join(''));
    if (flattened.includes(records.txtValue)) return { verified: true, method: 'TXT' };
  } catch {}
  return { verified: false, method: null };
}

function secondsToDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return null;
  const totalSeconds = Math.max(0, Math.floor(Number(seconds)));
  const hours   = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const secs    = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function emptyFirstPartyTraffic(domain) {
  return { monthly_visits: 0, pageviews: 0, unique_visitors: 0, bounce_rate: 0, avg_duration: null, top_country: null, domain };
}

async function estimateWebsiteTraffic(domain) {
  return { ...emptyFirstPartyTraffic(domain), mode: 'estimated' };
}

function formatCountdown(targetDate) {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return '00d 00h 00m';
  const totalMinutes = Math.floor(diff / 60000);
  const days    = Math.floor(totalMinutes / (60 * 24));
  const hours   = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

async function summarizeWebsiteTraffic(creatorId, domain) {
  const result = await query(
    `WITH events AS (
       SELECT * FROM website_traffic_events
       WHERE creator_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
     ),
     sessions AS (
       SELECT session_id,
         COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
         MAX(duration_seconds) AS duration_seconds,
         MAX(country) FILTER (WHERE country IS NOT NULL AND country != '') AS country
       FROM events GROUP BY session_id
     ),
     top_country AS (
       SELECT country FROM sessions WHERE country IS NOT NULL AND country != ''
       GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1
     )
     SELECT
       COUNT(*)::int AS monthly_visits,
       COALESCE(SUM(pageviews), 0)::int AS pageviews,
       COUNT(*) FILTER (WHERE pageviews = 1)::int AS bounced_visits,
       COALESCE(AVG(NULLIF(duration_seconds, 0)), 0)::float AS avg_duration_seconds,
       (SELECT country FROM top_country) AS top_country,
       (SELECT COUNT(DISTINCT visitor_hash)::int FROM events WHERE visitor_hash IS NOT NULL) AS unique_visitors
     FROM sessions;`,
    [creatorId],
  );
  const row = result.rows[0] || {};
  const monthlyVisits      = Number(row.monthly_visits      || 0);
  const pageviews          = Number(row.pageviews           || 0);
  const bouncedVisits      = Number(row.bounced_visits      || 0);
  const avgDurationSeconds = Number(row.avg_duration_seconds || 0);
  return {
    monthly_visits:  monthlyVisits,
    pageviews,
    unique_visitors: Number(row.unique_visitors || 0),
    bounce_rate:     monthlyVisits > 0 ? Math.round((bouncedVisits / monthlyVisits) * 100) : 0,
    avg_duration:    avgDurationSeconds > 0 ? secondsToDuration(avgDurationSeconds) : null,
    top_country:     row.top_country || null,
    domain,
  };
}

async function buildWebsiteTrafficSnapshot({ creatorId, domain, websiteStatus, websiteTraffic, actualStatsAvailableAt, forceActual = false }) {
  const actualReady    = actualStatsAvailableAt && new Date(actualStatsAvailableAt).getTime() <= Date.now();
  const shouldUseActual = forceActual || actualReady;

  if (websiteStatus !== 'verified') {
    return websiteTraffic?.mode === 'actual'
      ? websiteTraffic
      : { ...emptyFirstPartyTraffic(domain), mode: 'estimated', next_update_at: actualStatsAvailableAt || null, countdown: actualStatsAvailableAt ? formatCountdown(actualStatsAvailableAt) : null };
  }
  if (!shouldUseActual) {
    const estimate = websiteTraffic?.mode === 'estimated' ? websiteTraffic : await estimateWebsiteTraffic(domain);
    return { ...estimate, mode: 'estimated', next_update_at: actualStatsAvailableAt || null, countdown: actualStatsAvailableAt ? formatCountdown(actualStatsAvailableAt) : null };
  }
  const actual = await summarizeWebsiteTraffic(creatorId, domain);
  return { ...actual, mode: 'actual', next_update_at: actualStatsAvailableAt || null, countdown: actualStatsAvailableAt ? formatCountdown(actualStatsAvailableAt) : null };
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

const sseClients = new Map();

function addSseClient(creatorId, res) {
  if (!sseClients.has(creatorId)) sseClients.set(creatorId, new Set());
  sseClients.get(creatorId).add(res);
}
function removeSseClient(creatorId, res) {
  sseClients.get(creatorId)?.delete(res);
}
async function broadcastUnreadCount(creatorId) {
  const clients = sseClients.get(creatorId);
  if (!clients || clients.size === 0) return;
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS unread FROM notifications WHERE creator_id = $1 AND read = false`,
      [creatorId],
    );
    const count = rows[0]?.unread ?? 0;
    for (const res of clients) {
      try { res.write(`data: ${JSON.stringify({ unread: count })}\n\n`); } catch {}
    }
  } catch {}
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

exports.googleInitiate = (req, res) => {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const redirectUri  = `${req.protocol}://${req.get('host')}/auth/creator/google/callback`;
  if (!clientId) return res.status(500).json({ success: false, message: 'Google OAuth client ID not configured.' });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id',     clientId);
  authUrl.searchParams.set('redirect_uri',  redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope',         'openid email profile');
  authUrl.searchParams.set('access_type',   'online');
  authUrl.searchParams.set('prompt',        'select_account');
  res.redirect(authUrl.toString());
};

exports.googleCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}/login?error=missing_code`);

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.redirect(`${FRONTEND_URL}/login?error=google_config_missing`);

  const redirectUri = `${req.protocol}://${req.get('host')}/auth/creator/google/callback`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokenData = await tokenResponse.json().catch(() => null);
    if (!tokenData) return res.redirect(`${FRONTEND_URL}/login?error=invalid_token_response`);

    const accessToken = tokenData.access_token;
    if (!accessToken) return res.redirect(`${FRONTEND_URL}/login?error=missing_access_token`);

    const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken)}`);
    const userInfo    = await userInfoRes.json().catch(() => null);
    if (!userInfo?.sub) return res.redirect(`${FRONTEND_URL}/login?error=invalid_user_info`);

    const creatorId = await Creator.upsertFromGoogle({
      googleId: userInfo.sub,
      email:    userInfo.email    || '',
      fullName: userInfo.name     || '',
      avatar:   userInfo.picture  || '',
    });

    res.cookie('yepper_session', String(creatorId), {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/',
    });

    const creator = await Creator.findById(creatorId);
    if (!creator?.username || !creator?.what_they_do) {
      return res.redirect(`${FRONTEND_URL}/onboarding`);
    }
    return res.redirect(`${FRONTEND_URL}/explore`);
  } catch (err) {
    console.error('[creators] Google OAuth callback error:', err);
    return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
};

exports.getSession = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.json({ success: false, message: 'No session.' });

  const result = await query(
    `SELECT id, google_id, email, full_name, avatar, username, what_they_do,
            website_name, website_url, website_domain, website_status,
            website_icon, website_traffic, website_tracking_started_at,
            website_actual_stats_available_at, website_verified_at
     FROM creators WHERE id = $1 LIMIT 1;`,
    [session],
  );
  if (result.rowCount === 0) return res.json({ success: false, message: 'Session not found.' });

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
          name:                     user.website_name   ?? undefined,
          url:                      user.website_url    ?? undefined,
          domain:                   user.website_domain ?? undefined,
          status:                   user.website_status ?? 'not_connected',
          icon:                     user.website_icon   ?? undefined,
          traffic:                  user.website_traffic ?? {},
          tracking_started_at:      user.website_tracking_started_at ?? undefined,
          actual_stats_available_at:user.website_actual_stats_available_at ?? undefined,
          verified_at:              user.website_verified_at ?? undefined,
        },
        avatar: user.avatar ?? undefined,
        status: 'verified',
        role:   'creator',
      },
    },
  });
};

exports.checkUsername = async (req, res) => {
  const raw = String(req.query.username ?? '').trim().toLowerCase();
  if (!raw)              return res.json({ available: false, reason: 'Username is required.' });
  if (raw.length < 3)   return res.json({ available: false, reason: 'Must be at least 3 characters.' });
  if (raw.length > 50)  return res.json({ available: false, reason: 'Must be 50 characters or fewer.' });
  if (!/^[a-z0-9_\.]+$/.test(raw)) return res.json({ available: false, reason: 'Only letters, numbers, _ and . allowed.' });
  if (/^[_\.]/.test(raw) || /[_\.]$/.test(raw)) return res.json({ available: false, reason: 'Cannot start or end with _ or .' });

  const available = await Creator.isUsernameAvailable(raw);
  return res.json({ available, reason: available ? '' : 'Username is already taken.' });
};

exports.logout = (req, res) => {
  res.clearCookie('yepper_session', { path: '/' });
  return res.json({ success: true, message: 'Logged out.' });
};

// ─── Social stats ─────────────────────────────────────────────────────────────

exports.getSocialStats = async (req, res) => {
  const userUuid = req.query.user_uuid;
  if (!userUuid) return res.status(400).json({ success: false, message: 'user_uuid required' });
  try {
    const result = await query(
      `SELECT provider, username, followers_count, profile_url, connected_at
       FROM social_connections WHERE creator_id = $1 ORDER BY connected_at DESC`,
      [userUuid],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[creators] /api/social/stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch social stats' });
  }
};

exports.getSocialVideoStats = async (req, res) => {
  const { provider, user_uuid } = req.query;
  if (!provider || !user_uuid) return res.status(400).json({ success: false, message: 'provider and user_uuid required' });
  try {
    const result = await query(
      `SELECT title, views, likes, published_at, thumbnail_url, video_url
       FROM social_video_stats WHERE creator_id = $1 AND provider = $2
       ORDER BY published_at DESC LIMIT 5`,
      [user_uuid, provider],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[creators] /api/social/video-stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch video stats' });
  }
};

exports.disconnectSocial = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false });
  try {
    await query(`DELETE FROM social_connections WHERE creator_id=$1 AND provider=$2`, [session, req.params.provider]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] disconnect error:', err);
    return res.status(500).json({ success: false });
  }
};

// ─── Notifications ────────────────────────────────────────────────────────────

exports.getNotifications = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const result = await query(
      `SELECT id, type, title, body, read, created_at
       FROM notifications WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [session],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[creators] /api/notifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    await query(`UPDATE notifications SET read=true WHERE creator_id=$1 AND read=false`, [session]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] mark-read error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.deleteNotification = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    await query(`DELETE FROM notifications WHERE id=$1 AND creator_id=$2`, [req.params.id, session]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] delete notification error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.notificationsStream = (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const creatorId = session;
  addSseClient(creatorId, res);
  broadcastUnreadCount(creatorId);
  req.on('close', () => removeSseClient(creatorId, res));
};

// ─── Website ─────────────────────────────────────────────────────────────────

exports.getWebsite = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const data = await Creator.getWebsite(session);
    if (!data) return res.status(404).json({ success: false, message: 'Creator not found' });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[creators] GET /api/website error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.startWebsite = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const { websiteUrl, websiteName } = req.body;
  const normalized = normalizeWebsiteUrl(websiteUrl);
  if (!normalized) return res.status(400).json({ success: false, message: 'Invalid website URL' });

  try {
    const exists = await checkWebsiteExists(normalized.url);
    if (!exists) return res.status(400).json({ success: false, message: 'Website not reachable' });

    const token   = crypto.randomBytes(32).toString('hex');
    const records = websiteVerificationRecords(normalized.domain, token);

    await query(
      `UPDATE creators SET
         website_url=$2, website_domain=$3, website_name=$4,
         website_status='pending', website_verification_token=$5,
         website_verification_method=$6, website_verification_host=$7,
         website_verification_value=$8, updated_at=NOW()
       WHERE id=$1`,
      [session, normalized.url, normalized.domain, websiteName || normalized.domain,
       token, records.method, records.txtHost, records.txtValue],
    );
    return res.json({ success: true, data: { ...records, token } });
  } catch (err) {
    console.error('[creators] POST /api/website/start error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.verifyWebsite = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const result = await query(
      `SELECT website_domain, website_verification_token FROM creators WHERE id=$1 LIMIT 1`,
      [session],
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false });

    const { website_domain: domain, website_verification_token: token } = result.rows[0];
    if (!domain || !token) return res.status(400).json({ success: false, message: 'No verification pending' });

    const check = await checkDnsOwnership(domain, token);
    if (!check.verified) return res.json({ success: false, verified: false, message: 'DNS TXT record not found yet' });

    const trackingToken   = crypto.randomBytes(16).toString('hex');
    const trackingStartedAt = new Date();
    const actualStatsAt   = new Date(trackingStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE creators SET
         website_status='verified', website_verification_method=$2,
         website_tracking_token=$3, website_tracking_started_at=$4,
         website_actual_stats_available_at=$5, website_verified_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [session, check.method, trackingToken, trackingStartedAt, actualStatsAt],
    );
    return res.json({ success: true, verified: true });
  } catch (err) {
    console.error('[creators] POST /api/website/verify error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.refreshTraffic = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const result = await query(
      `SELECT website_domain, website_status, website_traffic, website_actual_stats_available_at
       FROM creators WHERE id=$1 LIMIT 1`,
      [session],
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false });

    const creator  = result.rows[0];
    const snapshot = await buildWebsiteTrafficSnapshot({
      creatorId:              session,
      domain:                 creator.website_domain,
      websiteStatus:          creator.website_status,
      websiteTraffic:         creator.website_traffic,
      actualStatsAvailableAt: creator.website_actual_stats_available_at,
      forceActual:            true,
    });
    await query(`UPDATE creators SET website_traffic=$2, updated_at=NOW() WHERE id=$1`, [session, JSON.stringify(snapshot)]);
    return res.json({ success: true, data: snapshot });
  } catch (err) {
    console.error('[creators] traffic refresh error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.deleteWebsite = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    await Creator.clearWebsite(session);
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] DELETE /api/website error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.connectWebsite = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const { websiteUrl, websiteName } = req.body;
  const normalized = normalizeWebsiteUrl(websiteUrl);
  if (!normalized) return res.status(400).json({ success: false, message: 'Invalid URL' });

  try {
    await query(
      `UPDATE creators SET website_url=$2, website_domain=$3, website_name=$4,
         website_status='pending', updated_at=NOW() WHERE id=$1`,
      [session, normalized.url, normalized.domain, websiteName || normalized.domain],
    );
    return res.json({ success: true, data: { url: normalized.url, domain: normalized.domain } });
  } catch (err) {
    console.error('[creators] /api/website/connect error:', err);
    return res.status(500).json({ success: false });
  }
};

// ─── Adsense bridge ───────────────────────────────────────────────────────────

exports.getHandoffData = async (req, res) => {
  const { token } = req.params;
  try {
    const result = await query(
      `SELECT ah.*, c.website_domain, c.website_url, c.full_name, c.email
       FROM adsense_handoffs ah
       JOIN creators c ON c.id = ah.creator_id
       WHERE ah.handoff_token = $1 AND ah.status = 'active' LIMIT 1`,
      [token],
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Handoff not found or expired' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[creators] handoff data error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.adsenseProceed = async (req, res) => {
  const session = req.cookies?.yepper_session;
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const creatorResult = await query(`SELECT website_domain FROM creators WHERE id=$1 LIMIT 1`, [session]);
    if (creatorResult.rowCount === 0) return res.status(404).json({ success: false });

    const handoffToken = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO adsense_handoffs (creator_id, website_domain, handoff_token) VALUES ($1,$2,$3)`,
      [session, creatorResult.rows[0].website_domain, handoffToken],
    );

    const ADSENSE_FRONTEND = process.env.THIRD_PARTY_WEBSITE_URL || `${FRONTEND_URL}/adsense`;
    return res.json({ success: true, redirect: `${ADSENSE_FRONTEND}?handoff=${handoffToken}` });
  } catch (err) {
    console.error('[creators] adsense proceed error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.redeemHandoff = async (req, res) => {
  const { token } = req.params;
  try {
    const result = await query(
      `UPDATE adsense_handoffs SET status='used', used_at=NOW()
       WHERE handoff_token=$1 AND status='active' RETURNING *`,
      [token],
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Invalid or expired handoff token' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[creators] adsense handoff redeem error:', err);
    return res.status(500).json({ success: false });
  }
};

// ─── Social OAuth ─────────────────────────────────────────────────────────────

exports.socialConnect = (req, res) => {
  const { provider }  = req.params;
  const { user_uuid } = req.query;
  const backendUrl    = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

  if (provider === 'youtube') {
    const clientId    = process.env.YOUTUBE_CLIENT_ID;
    const redirectUri = `${backendUrl}/api/connect/youtube/callback`;
    if (!clientId) return res.status(500).json({ error: 'YouTube client ID not configured' });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id',     clientId);
    authUrl.searchParams.set('redirect_uri',  redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope',         'https://www.googleapis.com/auth/youtube.readonly');
    authUrl.searchParams.set('access_type',   'offline');
    authUrl.searchParams.set('state',         user_uuid || '');
    return res.redirect(authUrl.toString());
  }
  return res.status(400).json({ error: `Unsupported provider: ${provider}` });
};

exports.socialConnectCallback = async (req, res) => {
  const { provider }    = req.params;
  const { code, state } = req.query;
  const userUuid        = state;
  const backendUrl      = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

  if (provider === 'youtube') {
    const clientId     = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri  = `${backendUrl}/api/connect/youtube/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${FRONTEND_URL}/connect-accounts?error=config_missing`);
    }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return res.redirect(`${FRONTEND_URL}/connect-accounts?error=token_error`);

      const channelRes  = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      const channelData = await channelRes.json();
      const channel     = channelData.items?.[0];

      if (channel) {
        await query(
          `INSERT INTO social_connections (creator_id, provider, username, followers_count, profile_url, access_token, refresh_token)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (creator_id, provider) DO UPDATE SET
             username=EXCLUDED.username, followers_count=EXCLUDED.followers_count,
             access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token,
             connected_at=NOW()`,
          [userUuid, 'youtube', channel.snippet?.title || '', channel.statistics?.subscriberCount || 0,
           `https://youtube.com/channel/${channel.id}`, tokenData.access_token, tokenData.refresh_token || null],
        );
      }
      return res.redirect(`${FRONTEND_URL}/connect-accounts?success=youtube`);
    } catch (err) {
      console.error('[creators] YouTube callback error:', err);
      return res.redirect(`${FRONTEND_URL}/connect-accounts?error=server_error`);
    }
  }
  return res.redirect(`${FRONTEND_URL}/connect-accounts?error=unsupported_provider`);
};

// ─── Webhook verification ─────────────────────────────────────────────────────

exports.instagramWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = 'yepper_secret_token_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[creators] WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
};
