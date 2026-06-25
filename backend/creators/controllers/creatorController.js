'use strict';

const crypto    = require('crypto');
const dns       = require('dns/promises');
const nodemailer = require('nodemailer');
const jwt       = require('jsonwebtoken');

const { query } = require('../../config/db');
const Creator   = require('../models/Creator');
const { addSseClient, removeSseClient, broadcastUnreadCount, createNotification } = require('../utils/notificationUtils');

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return process.env.JWT_SECRET;
};

function generateCreatorToken(creator) {
  const payload = {
    userId:     String(creator.id),
    email:      creator.email      || undefined,
    name:       creator.full_name  || undefined,
    username:   creator.username   || undefined,
    whatTheyDo: creator.what_they_do || undefined,
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: '7d' });
}

function getCreatorId(req) {
  const val = req.cookies?.yepper_session;
  if (!val) return null;
  if (val.split('.').length === 3) {
    try {
      const decoded = jwt.verify(val, JWT_SECRET());
      return decoded.userId || decoded.id || null;
    } catch {
      return null;
    }
  }
  return val; // legacy: raw integer stored as string
}

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

// SSE clients and notification helpers are in ../utils/notificationUtils.js

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

    const { id: creatorId, isNew } = await Creator.upsertFromGoogle({
      googleId: userInfo.sub,
      email:    userInfo.email    || '',
      fullName: userInfo.name     || '',
      avatar:   userInfo.picture  || '',
    });

    const creator = await Creator.findById(creatorId);
    const token   = generateCreatorToken(creator || { id: creatorId });

    if (isNew) {
      const displayName = userInfo.name || userInfo.email || 'there';
      createNotification(creatorId, 'welcome', 'Welcome to Yepper!',
        `Hey ${displayName.split(' ')[0]}, your creator account is ready. Connect your social accounts and add your website to get started.`,
        { icon: '🎉' }
      ).catch(() => {});
      sendEmail(
        userInfo.email,
        'Welcome to Yepper!',
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 8px">Welcome to Yepper, ${displayName.split(' ')[0]}!</h2>
          <p style="color:#6b7280">Your creator account is ready. Here's how to get started:</p>
          <ul style="color:#374151;padding-left:20px">
            <li style="margin-bottom:8px">Connect your social media accounts (YouTube, Instagram, etc.)</li>
            <li style="margin-bottom:8px">Add your website to start earning from ad placements</li>
            <li style="margin-bottom:8px">Track your analytics and earnings from the dashboard</li>
          </ul>
          <a href="${FRONTEND_URL}/explore" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Go to Dashboard →</a>
        </div>`
      ).catch(() => {});
    }

    res.cookie('yepper_session', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/',
    });

    if (!creator?.username || !creator?.what_they_do) {
      return res.redirect(`${FRONTEND_URL}/choose-role`);
    }
    return res.redirect(`${FRONTEND_URL}/explore`);
  } catch (err) {
    console.error('[creators] Google OAuth callback error:', err);
    return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
};

exports.getSession = async (req, res) => {
  const creatorId = getCreatorId(req);
  if (!creatorId) return res.json({ success: false, message: 'No session.' });

  const result = await query(
    `SELECT id, google_id, email, full_name, avatar, username, what_they_do,
            website_name, website_url, website_domain, website_status,
            website_icon, website_traffic, website_tracking_started_at,
            website_actual_stats_available_at, website_verified_at
     FROM creators WHERE id = $1 LIMIT 1;`,
    [creatorId],
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
      `SELECT provider, username, followers_count, profile_url, connected_at,
              COALESCE(total_views, 0) AS total_views, COALESCE(total_posts, 0) AS total_posts
       FROM social_connections WHERE creator_id = $1 ORDER BY connected_at DESC`,
      [userUuid],
    );
    const data = result.rows.map(r => ({
      provider:  r.provider,
      username:  r.username || '',
      followers: Number(r.followers_count || 0),
      avatar:    r.profile_url || '',
      analysis: {
        total_views:      Number(r.total_views  || 0),
        total_posts:      Number(r.total_posts  || 0),
        engagement_score: '0',
        predicted_reach:  0,
        predicted_likes:  0,
        recommendation:   '',
        ai_review:        '',
        growth_trend:     'steady',
      },
    }));
    return res.json({ success: true, data });
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
      `SELECT * FROM (
         SELECT DISTINCT ON (COALESCE(video_url, title))
           title,
           views,
           likes,
           0 AS comments,
           published_at,
           thumbnail_url AS thumbnail,
           video_url     AS url
         FROM social_video_stats
         WHERE creator_id = $1 AND provider = $2
         ORDER BY COALESCE(video_url, title), published_at DESC NULLS LAST, id DESC
       ) deduped
       ORDER BY published_at DESC NULLS LAST
       LIMIT 5`,
      [user_uuid, provider],
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[creators] /api/social/video-stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch video stats' });
  }
};

// GET /api/creators/public — public, no auth. Powers the marketing homepage:
// every creator with a connected YouTube channel, plus their most recent videos.
exports.getPublicCreators = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         c.id, c.username, c.full_name, c.avatar, c.what_they_do,
         sc.username    AS channel_name,
         sc.profile_url AS channel_url,
         sc.followers_count AS subscribers,
         COALESCE(sc.total_views, 0) AS total_views,
         COALESCE(v.videos, '[]'::json) AS videos
       FROM creators c
       JOIN social_connections sc ON sc.creator_id = c.id AND sc.provider = 'youtube'
       LEFT JOIN LATERAL (
         SELECT json_agg(t) AS videos FROM (
           SELECT DISTINCT ON (COALESCE(video_url, title))
             title, views, likes, published_at,
             thumbnail_url AS thumbnail, video_url AS url
           FROM social_video_stats
           WHERE creator_id = c.id AND provider = 'youtube'
           ORDER BY COALESCE(video_url, title), published_at DESC NULLS LAST, id DESC
           LIMIT 4
         ) t
       ) v ON true
       ORDER BY sc.followers_count DESC NULLS LAST, c.created_at DESC
       LIMIT 60`,
    );

    const data = result.rows.map(r => ({
      id:          String(r.id),
      username:    r.username ?? '',
      name:        r.full_name || r.username || 'Creator',
      avatar:      r.avatar || null,
      whatTheyDo:  r.what_they_do || null,
      channelName: r.channel_name || r.full_name || '',
      channelUrl:  r.channel_url || null,
      subscribers: Number(r.subscribers || 0),
      totalViews:  Number(r.total_views || 0),
      videos:      r.videos || [],
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[creators] /api/creators/public error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch creators' });
  }
};

exports.disconnectSocial = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false });
  try {
    await query(`DELETE FROM social_connections WHERE creator_id=$1 AND provider=$2`, [session, req.params.provider]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] disconnect error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.refreshSocialStats = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false });
  const { provider } = req.params;

  if (provider !== 'youtube') return res.json({ success: false, message: 'Unsupported provider' });

  try {
    const conn = await query(
      `SELECT access_token, refresh_token FROM social_connections WHERE creator_id=$1 AND provider=$2 LIMIT 1`,
      [session, provider],
    );
    if (!conn.rowCount) return res.json({ success: false, message: 'Not connected' });

    let { access_token: token, refresh_token: refreshToken } = conn.rows[0];

    const fetchChannel = async (t) => {
      try {
        const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true', {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (r.status !== 200) return null;
        return r.json().catch(() => null);
      } catch { return null; }
    };

    let channelData = await fetchChannel(token);

    // Access token expired — try to refresh
    if (!channelData?.items?.[0] && refreshToken) {
      const clientId     = process.env.YOUTUBE_CLIENT_ID;
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const refreshRes  = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
        });
        const refreshData = await refreshRes.json().catch(() => null);
        if (refreshData?.access_token) {
          token = refreshData.access_token;
          await query(`UPDATE social_connections SET access_token=$1 WHERE creator_id=$2 AND provider=$3`, [token, session, provider]);
          channelData = await fetchChannel(token);
        }
      }
    }

    const channel = channelData?.items?.[0];
    if (!channel) return res.json({ success: false, message: 'Could not refresh channel data' });

    await query(
      `UPDATE social_connections SET followers_count=$1, total_views=$2, total_posts=$3, username=$4 WHERE creator_id=$5 AND provider=$6`,
      [Number(channel.statistics?.subscriberCount || 0), Number(channel.statistics?.viewCount || 0),
       Number(channel.statistics?.videoCount || 0), channel.snippet?.title || '', session, provider],
    );

    // Refresh last 5 videos — read the channel's uploads playlist directly rather than
    // search.list, which can lag behind for just-published videos (search indexing delay).
    try {
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
      const playlistRes  = uploadsPlaylistId
        ? await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=5`, { headers: { Authorization: `Bearer ${token}` } })
        : null;
      const playlistData = playlistRes ? await playlistRes.json().catch(() => null) : null;
      const videoIds   = (playlistData?.items || []).map((it) => it.contentDetails?.videoId).filter(Boolean);
      if (videoIds.length) {
        const vidsRes  = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
        const vidsData = await vidsRes.json().catch(() => null);
        if (Array.isArray(vidsData?.items)) {
          for (const v of vidsData.items) {
            await query(
              `INSERT INTO social_video_stats (creator_id, provider, title, views, likes, published_at, thumbnail_url, video_url)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (creator_id, provider, video_url) WHERE video_url IS NOT NULL DO UPDATE SET
                 title=EXCLUDED.title, views=EXCLUDED.views, likes=EXCLUDED.likes,
                 published_at=EXCLUDED.published_at, thumbnail_url=EXCLUDED.thumbnail_url, fetched_at=NOW()`,
              [session, 'youtube', v.snippet?.title || '', Number(v.statistics?.viewCount || 0),
               Number(v.statistics?.likeCount || 0),
               v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
               v.snippet?.thumbnails?.default?.url || '', `https://youtu.be/${v.id}`],
            );
          }
          // Keep only the 5 most recent videos per creator/provider
          await query(
            `DELETE FROM social_video_stats WHERE creator_id=$1 AND provider=$2
             AND id NOT IN (SELECT id FROM social_video_stats WHERE creator_id=$1 AND provider=$2 ORDER BY published_at DESC NULLS LAST, id DESC LIMIT 5)`,
            [session, 'youtube'],
          );
        }
      }
    } catch (err) {
      console.error('[creators] Video refresh error (non-fatal):', err);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] refreshSocialStats error:', err);
    return res.status(500).json({ success: false });
  }
};

// ─── Notifications ────────────────────────────────────────────────────────────

exports.getNotifications = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);
    const [result, countResult] = await Promise.all([
      query(
        `SELECT id, type, title, body, meta, is_read, created_at
         FROM notifications WHERE creator_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [session, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS unread FROM notifications WHERE creator_id = $1 AND is_read = false`,
        [session],
      ),
    ]);
    return res.json({ success: true, data: result.rows, meta: { unread: countResult.rows[0]?.unread ?? 0 } });
  } catch (err) {
    console.error('[creators] /api/notifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const { id } = req.body;
    if (id) {
      await query(`UPDATE notifications SET is_read=true WHERE id=$1 AND creator_id=$2`, [id, session]);
    } else {
      await query(`UPDATE notifications SET is_read=true WHERE creator_id=$1 AND is_read=false`, [session]);
    }
    broadcastUnreadCount(session).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] mark-read error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.deleteNotification = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    await query(`DELETE FROM notifications WHERE id=$1 AND creator_id=$2`, [req.params.id, session]);
    broadcastUnreadCount(session).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    console.error('[creators] delete notification error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.notificationsStream = (req, res) => {
  const session = getCreatorId(req);
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
  const session = getCreatorId(req);
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
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const { websiteUrl, websiteName } = req.body;
  const normalized = normalizeWebsiteUrl(websiteUrl);
  if (!normalized) return res.status(400).json({ success: false, message: 'Invalid website URL' });

  try {
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
  const session = getCreatorId(req);
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
  const session = getCreatorId(req);
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
  const session = getCreatorId(req);
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
  const session = getCreatorId(req);
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
  const session = getCreatorId(req);
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
    authUrl.searchParams.set('scope',         'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload');
    authUrl.searchParams.set('access_type',   'offline');
    // Google only issues a refresh_token on a user's first consent for this app+scope —
    // without forcing the consent screen again, a reconnect can silently come back with
    // no refresh_token, leaving the connection stuck once the access token expires.
    authUrl.searchParams.set('prompt',        'consent');
    authUrl.searchParams.set('state',         user_uuid || '');
    return res.redirect(authUrl.toString());
  }
  return res.status(400).json({ error: `Unsupported provider: ${provider}` });
};

exports.socialConnectCallback = async (req, res) => {
  const { provider }    = req.params;
  const { code, state } = req.query;
  // Prefer state (set by the proxy), but fall back to server-side session cookie if present.
  const userUuidFromState = state;
  const userUuid = userUuidFromState || getCreatorId(req) || null;
  const backendUrl      = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

  if (provider === 'youtube') {
    const clientId     = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri  = `${backendUrl}/api/connect/youtube/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${FRONTEND_URL}/oauth-callback?error=config_missing`);
    }

    // Validate userUuid is a usable integer ID before any DB work
    const parsedId = parseInt(userUuid, 10);
    if (!userUuid || isNaN(parsedId)) {
      console.error('[creators] YouTube callback: invalid or missing creator ID in state', { userUuid });
      return res.redirect(`${FRONTEND_URL}/oauth-callback?error=session_missing`);
    }
    const creatorId = String(parsedId);

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const tokenData = await tokenRes.json().catch(() => null);
      if (!tokenData || !tokenData.access_token) {
        console.error('[creators] YouTube token exchange failed', { tokenData });
        return res.redirect(`${FRONTEND_URL}/oauth-callback?error=token_error`);
      }

      const channelRes  = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true`, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      const channelData = await channelRes.json().catch(() => null);
      const channel     = channelData?.items?.[0];

      if (!channel) {
        console.error('[creators] YouTube channel fetch failed', { channelData });
        return res.redirect(`${FRONTEND_URL}/oauth-callback?error=channel_missing`);
      }

      await query(
        `INSERT INTO social_connections (creator_id, provider, username, followers_count, profile_url, access_token, refresh_token, total_views, total_posts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (creator_id, provider) DO UPDATE SET
           username=EXCLUDED.username, followers_count=EXCLUDED.followers_count,
           access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token,
           total_views=EXCLUDED.total_views, total_posts=EXCLUDED.total_posts,
           connected_at=NOW()`,
        [creatorId, 'youtube', channel.snippet?.title || '', Number(channel.statistics?.subscriberCount || 0),
         `https://youtube.com/channel/${channel.id}`, tokenData.access_token, tokenData.refresh_token || null,
         Number(channel.statistics?.viewCount || 0), Number(channel.statistics?.videoCount || 0)],
      );

      const channelName = channel.snippet?.title || 'your channel';
      const subscribers = Number(channel.statistics?.subscriberCount || 0).toLocaleString();
      createNotification(creatorId, 'social_connected', 'YouTube Connected',
        `${channelName} connected successfully — ${subscribers} subscribers`,
        { provider: 'youtube', channel_id: channel.id, channel_name: channelName }
      ).catch(() => {});

      // Fetch latest 5 videos and store basic stats so frontend can show estimates immediately.
      // Reads the channel's uploads playlist directly rather than search.list, which can lag
      // behind for just-published videos (search indexing delay) — common right after connect.
      try {
        const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
        const playlistRes = uploadsPlaylistId
          ? await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=5`, {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            })
          : null;
        const playlistData = playlistRes ? await playlistRes.json().catch(() => null) : null;
        const videoIds = (playlistData?.items || []).map((it) => it.contentDetails?.videoId).filter(Boolean);
        if (videoIds.length) {
          const vidsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const vidsData = await vidsRes.json().catch(() => null);
          if (Array.isArray(vidsData?.items)) {
            for (const v of vidsData.items) {
              await query(
                `INSERT INTO social_video_stats (creator_id, provider, title, views, likes, published_at, thumbnail_url, video_url)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (creator_id, provider, video_url) DO UPDATE SET
                   title=EXCLUDED.title, views=EXCLUDED.views, likes=EXCLUDED.likes,
                   published_at=EXCLUDED.published_at, thumbnail_url=EXCLUDED.thumbnail_url, fetched_at=NOW()`,
                [creatorId, 'youtube', v.snippet?.title || '', Number(v.statistics?.viewCount || 0),
                 Number(v.statistics?.likeCount || 0),
                 v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
                 v.snippet?.thumbnails?.default?.url || '', `https://youtu.be/${v.id}`],
              );
            }
            // Keep only the 5 most recent videos per creator/provider
            await query(
              `DELETE FROM social_video_stats WHERE creator_id=$1 AND provider=$2
               AND id NOT IN (SELECT id FROM social_video_stats WHERE creator_id=$1 AND provider=$2 ORDER BY published_at DESC NULLS LAST, id DESC LIMIT 5)`,
              [creatorId, 'youtube'],
            );
          }
        }
      } catch (err) {
        console.error('[creators] Failed to fetch/store youtube videos (non-fatal):', err);
      }

      return res.redirect(`${FRONTEND_URL}/oauth-callback?success=youtube`);
    } catch (err) {
      console.error('[creators] YouTube callback error:', err && err.stack ? err.stack : err);
      return res.redirect(`${FRONTEND_URL}/oauth-callback?error=server_error`);
    }
  }
  return res.redirect(`${FRONTEND_URL}/oauth-callback?error=unsupported_provider`);
};

// ─── Ad Video Posts ───────────────────────────────────────────────────────────

const fs = require('fs');
const os = require('os');
const path = require('path');
const { applyAdOverlay, estimateOverlaySeconds, computeSlotTimes, probeDuration } = require('../utils/adOverlay');

async function downloadToTemp(url, suffix) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ad creative (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `ypr_claim_${Date.now()}_${Math.random().toString(36).slice(2)}${suffix}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

const TRACKING_PREFIXES = { youtube: 'YT', instagram: 'IG', facebook: 'FB' };

function trackingCode(provider, num) {
  const prefix = TRACKING_PREFIXES[provider] || provider.toUpperCase().slice(0, 2);
  return `#YPR-${prefix}-${String(num).padStart(3, '0')}`;
}

// Pure function of marker count — exposed so the upload modal can show a
// time estimate before committing to the auto-overlay path.
exports.estimateAdOverlay = (req, res) => {
  const markerCount = parseInt(req.query.markers, 10) || 0;
  return res.json({ success: true, data: { estimatedSeconds: estimateOverlaySeconds(markerCount) } });
};

exports.postAdVideo = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false });

  const { provider } = req.params;
  const { title = '', description = '', privacy = 'public', mode = 'manual' } = req.body;

  const videoFile = req.files?.video?.[0];
  const adImageFile = req.files?.adImage?.[0];
  if (!videoFile) return res.status(400).json({ success: false, message: 'No video file uploaded' });

  let videoPath = videoFile.path;
  let videoMime = videoFile.mimetype || 'video/mp4';
  let videoSize = videoFile.size;
  let overlayCleanup = null;
  let claimedSlotTypes = [];
  const downloadedImagePaths = [];

  const cleanup = () => {
    try { fs.unlinkSync(videoFile.path); } catch {}
    if (adImageFile) { try { fs.unlinkSync(adImageFile.path); } catch {} }
    downloadedImagePaths.forEach((p) => { try { fs.unlinkSync(p); } catch {} });
    if (overlayCleanup) overlayCleanup();
  };

  try {
    // Parsed regardless of mode: even in manual mode (creator downloads the
    // claimed creative and adds it themselves) the claim still gets marked
    // used once the post succeeds — see the UPDATE below.
    try { claimedSlotTypes = JSON.parse(req.body.claimedSlotTypes || '[]'); } catch { claimedSlotTypes = []; }

    let placements = [];
    if (mode === 'auto' && Array.isArray(claimedSlotTypes) && claimedSlotTypes.length) {
      // Real advertiser-claimed slots — recompute placement times server-side
      // (source of truth) and pull each advertiser's own creative image.
      const duration = await probeDuration(videoFile.path);
      const slotTimes = computeSlotTimes(duration);
      const claimsRes = await query(
        `SELECT slot_type, image_url, ad_type, ad_size FROM youtube_ad_claims WHERE creator_id=$1 AND status='pending' AND slot_type = ANY($2)`,
        [session, claimedSlotTypes],
      );
      for (const row of claimsRes.rows) {
        const time = slotTimes[row.slot_type];
        if (time == null) continue; // e.g. video too short for that slot
        const imagePath = await downloadToTemp(row.image_url, path.extname(row.image_url) || '.png');
        downloadedImagePaths.push(imagePath);
        placements.push({ time, imagePath, adType: row.ad_type, adSize: row.ad_size });
      }
    } else if (mode === 'auto' && adImageFile) {
      // Test/manual creative — same image at every chosen marker.
      let markers = [];
      try { markers = JSON.parse(req.body.markers || '[]'); } catch { markers = []; }
      placements = (Array.isArray(markers) ? markers : []).map((time) => ({ time, imagePath: adImageFile.path }));
    }

    if (placements.length) {
      const { outputPath, cleanup: cleanupOverlay } = await applyAdOverlay({ videoPath: videoFile.path, placements });
      videoPath = outputPath;
      videoMime = 'video/mp4';
      videoSize = fs.statSync(outputPath).size;
      overlayCleanup = cleanupOverlay;
    }
    const conn = await query(
      `SELECT access_token FROM social_connections WHERE creator_id=$1 AND provider=$2 LIMIT 1`,
      [session, provider],
    );
    if (!conn.rowCount) { cleanup(); return res.status(404).json({ success: false, message: `Not connected to ${provider}` }); }
    const { access_token } = conn.rows[0];

    // Atomically get next tracking number
    const seqRes = await query(
      `INSERT INTO ad_tracking_sequences (provider, last_id) VALUES ($1, 1)
       ON CONFLICT (provider) DO UPDATE SET last_id = ad_tracking_sequences.last_id + 1
       RETURNING last_id`,
      [provider],
    );
    const trackingNum = seqRes.rows[0].last_id;
    const code = trackingCode(provider, trackingNum);

    const fullDescription = description ? `${description}\n\n${code}` : code;

    if (provider === 'youtube') {
      // 1. Initiate resumable upload session
      const initRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': videoMime,
            'X-Upload-Content-Length': String(videoSize),
          },
          body: JSON.stringify({
            snippet: { title: title || 'Ad Video', description: fullDescription, categoryId: '22' },
            status:  { privacyStatus: privacy },
          }),
        },
      );

      if (!initRes.ok) {
        cleanup();
        if (initRes.status === 401 || initRes.status === 403) {
          return res.status(403).json({ success: false, message: 'YouTube upload not authorized. Please reconnect your YouTube account to grant upload permissions.', code: 'reconnect_required' });
        }
        return res.status(500).json({ success: false, message: 'Failed to start YouTube upload' });
      }

      const uploadUrl = initRes.headers.get('location');
      if (!uploadUrl) { cleanup(); return res.status(500).json({ success: false, message: 'YouTube did not return upload URL' }); }

      // 2. Read file and upload to YouTube
      const videoBuffer = await fs.promises.readFile(videoPath);
      cleanup();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoMime, 'Content-Length': String(videoBuffer.byteLength) },
        body: videoBuffer,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        console.error('[creators] YouTube video upload failed:', uploadRes.status, errText);
        return res.status(500).json({ success: false, message: 'Video upload to YouTube failed' });
      }

      const videoData  = await uploadRes.json().catch(() => null);
      const videoId    = videoData?.id;
      const videoUrl   = videoId ? `https://youtube.com/watch?v=${videoId}` : null;
      const thumbUrl   = videoData?.snippet?.thumbnails?.default?.url || null;

      await query(
        `INSERT INTO ad_video_posts
           (creator_id, provider, tracking_code, tracking_num, platform_video_id, video_url, title, description, thumbnail_url, status, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'live',NOW())`,
        [session, provider, code, trackingNum, videoId, videoUrl, title || 'Ad Video', fullDescription, thumbUrl],
      );

      if (Array.isArray(claimedSlotTypes) && claimedSlotTypes.length) {
        await query(
          `UPDATE youtube_ad_claims SET status='used', used_at=NOW() WHERE creator_id=$1 AND status='pending' AND slot_type = ANY($2)`,
          [session, claimedSlotTypes],
        );
      }

      return res.json({ success: true, data: { trackingCode: code, videoUrl, platformVideoId: videoId } });
    }

    // Instagram / Facebook — not yet supported
    cleanup();
    const platformLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
    return res.status(400).json({ success: false, message: `${platformLabel} video upload is coming soon` });

  } catch (err) {
    cleanup();
    console.error('[creators] postAdVideo error:', err?.stack || err);
    return res.status(500).json({ success: false, message: 'Upload failed unexpectedly' });
  }
};

exports.getAdPosts = async (req, res) => {
  const userUuid = req.query.user_uuid;
  const provider = req.query.provider;
  if (!userUuid) return res.status(400).json({ success: false, message: 'user_uuid required' });
  try {
    const result = await query(
      `SELECT id, provider, tracking_code, tracking_num, platform_video_id, video_url,
              title, description, thumbnail_url, status, posted_at
       FROM ad_video_posts
       WHERE creator_id = $1 ${provider ? 'AND provider = $2' : ''}
       ORDER BY posted_at DESC LIMIT 30`,
      provider ? [userUuid, provider] : [userUuid],
    );

    const posts = result.rows.map(r => ({ ...r, views: 0, likes: 0, comments: 0 }));

    // Fetch live stats directly from YouTube — never read from DB
    const ytPosts = posts.filter(p => p.provider === 'youtube' && p.platform_video_id);
    if (ytPosts.length) {
      const connRes = await query(
        `SELECT access_token FROM social_connections WHERE creator_id=$1 AND provider='youtube' LIMIT 1`,
        [userUuid],
      );
      if (connRes.rowCount) {
        const { access_token } = connRes.rows[0];
        const ids = ytPosts.map(p => p.platform_video_id).join(',');
        try {
          const ytRes    = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          const ytData   = await ytRes.json().catch(() => null);
          const statsMap = {};
          for (const item of ytData?.items ?? []) {
            statsMap[item.id] = {
              views:     Number(item.statistics?.viewCount    || 0),
              likes:     Number(item.statistics?.likeCount    || 0),
              comments:  Number(item.statistics?.commentCount || 0),
              thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
            };
          }

          // Any YouTube post not returned by the API has been deleted on YouTube — remove it
          const deletedIds = ytPosts
            .filter(p => !statsMap[p.platform_video_id])
            .map(p => p.id);

          if (deletedIds.length) {
            await query(
              `DELETE FROM ad_video_posts WHERE id = ANY($1::int[])`,
              [deletedIds],
            ).catch(e => console.error('[creators] getAdPosts delete orphan error:', e?.message));
          }

          for (const post of posts) {
            const live = statsMap[post.platform_video_id];
            if (live) {
              post.views    = live.views;
              post.likes    = live.likes;
              post.comments = live.comments;
              if (live.thumbnail) post.thumbnail_url = live.thumbnail;
            }
          }

          // Remove deleted entries from the response
          posts.splice(0, posts.length, ...posts.filter(p =>
            p.provider !== 'youtube' || !p.platform_video_id || statsMap[p.platform_video_id]
          ));
        } catch (err) {
          console.error('[creators] getAdPosts live-stats error (non-fatal):', err?.message);
        }
      }
    }

    return res.json({ success: true, data: posts });
  } catch (err) {
    console.error('[creators] getAdPosts error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.refreshAllAdPostStats = async () => {
  try {
    const posts = await query(
      `SELECT avp.id, avp.provider, avp.platform_video_id, sc.access_token
       FROM ad_video_posts avp
       JOIN social_connections sc ON sc.creator_id = avp.creator_id AND sc.provider = avp.provider
       WHERE avp.status = 'live' AND avp.platform_video_id IS NOT NULL
         AND (avp.last_stats_at IS NULL OR avp.last_stats_at < NOW() - INTERVAL '30 minutes')
       LIMIT 100`,
    );
    for (const post of posts.rows) {
      try {
        if (post.provider === 'youtube') {
          const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.platform_video_id}`, {
            headers: { Authorization: `Bearer ${post.access_token}` },
          });
          const data = await r.json().catch(() => null);
          const stats = data?.items?.[0]?.statistics;
          if (stats) {
            await query(
              `UPDATE ad_video_posts SET views=$1, likes=$2, comments=$3, last_stats_at=NOW() WHERE id=$4`,
              [Number(stats.viewCount || 0), Number(stats.likeCount || 0), Number(stats.commentCount || 0), post.id],
            );
          }
        }
      } catch (err) {
        console.error(`[cron] Ad post ${post.id} stats refresh error:`, err?.message);
      }
    }
  } catch (err) {
    console.error('[cron] refreshAllAdPostStats error:', err?.message);
  }
};

// ─── Wallet ──────────────────────────────────────────────────────────────────

exports.getWallet = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const result = await query(
      `SELECT id, balance, currency FROM wallets WHERE owner_id = $1 AND owner_type = 'creator' LIMIT 1`,
      [String(session)],
    );
    if (result.rowCount === 0) {
      // No wallet yet — return zero balance
      return res.json({ success: true, data: { balance: 0, currency: 'RWF' } });
    }
    const w = result.rows[0];
    return res.json({ success: true, data: { balance: Number(w.balance || 0), currency: w.currency || 'RWF' } });
  } catch (err) {
    console.error('[creators] GET /api/wallet error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch wallet' });
  }
};

exports.getWalletTransactions = async (req, res) => {
  const session = getCreatorId(req);
  if (!session) return res.status(401).json({ success: false, message: 'Not authenticated' });
  try {
    const walletRes = await query(
      `SELECT id FROM wallets WHERE owner_id = $1 AND owner_type = 'creator' LIMIT 1`,
      [String(session)],
    );
    if (walletRes.rowCount === 0) return res.json({ success: true, data: [] });

    const walletId = walletRes.rows[0].id;
    const txRes = await query(
      `SELECT id, amount, direction, description AS note, created_at
       FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [walletId],
    );
    return res.json({ success: true, data: txRes.rows });
  } catch (err) {
    console.error('[creators] GET /api/wallet/transactions error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
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
