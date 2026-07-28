'use strict';

const { query } = require('../../config/db');

// In-memory SSE client registry — shared across the whole process
const sseClients = new Map(); // creatorId (string) → Set<res>

function addSseClient(creatorId, res) {
  const key = String(creatorId);
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  sseClients.get(key).add(res);
}

function removeSseClient(creatorId, res) {
  sseClients.get(String(creatorId))?.delete(res);
}

async function broadcastUnreadCount(creatorId) {
  const clients = sseClients.get(String(creatorId));
  if (!clients || clients.size === 0) return;
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS unread FROM notifications WHERE creator_id = $1 AND is_read = false`,
      [creatorId],
    );
    const count = rows[0]?.unread ?? 0;
    for (const res of clients) {
      try { res.write(`event: unread\ndata: ${JSON.stringify({ unread: count })}\n\n`); } catch {}
    }
  } catch {}
}

async function createNotification(creatorId, type, title, body = null, meta = {}) {
  try {
    await query(
      `INSERT INTO notifications (creator_id, type, title, body, meta) VALUES ($1, $2, $3, $4, $5)`,
      [creatorId, type, title, body, JSON.stringify(meta)],
    );
    broadcastUnreadCount(String(creatorId)).catch(() => {});
  } catch (err) {
    console.error('[notifications] Failed to create notification:', err.message);
  }
}

// Throttle repeat "domain mismatch" alerts — a stray/misused script tag can
// fire on every pageview, so only notify once per (website, foundDomain) per day.
const mismatchThrottle = new Map(); // `${websiteId}:${foundDomain}` → last-notified ms

async function notifyDomainMismatch(ownerId, websiteId, verifiedDomain, foundDomain) {
  const key = `${websiteId}:${foundDomain}`;
  const last = mismatchThrottle.get(key);
  const now = Date.now();
  if (last && now - last < 24 * 60 * 60 * 1000) return;
  mismatchThrottle.set(key, now);

  await createNotification(
    ownerId,
    'domain_mismatch',
    'Ad script found on an unverified domain',
    `The website you verified is "${verifiedDomain}" but your ad script was just loaded from "${foundDomain}". The ad was not served there. If this isn't expected, check where you've pasted the embed code.`,
    { websiteId, verifiedDomain, foundDomain },
  );
}

// Throttle repeat "page mismatch" alerts the same way — a div left on the
// wrong page fires on every pageview there, so only notify once per
// (category, actualPath) per day.
const pageMismatchThrottle = new Map(); // `${categoryId}:${actualPath}` → last-notified ms

async function notifyPageMismatch(ownerId, categoryId, categoryName, expectedPath, actualPath) {
  const key = `${categoryId}:${actualPath}`;
  const last = pageMismatchThrottle.get(key);
  const now = Date.now();
  if (last && now - last < 24 * 60 * 60 * 1000) return;
  pageMismatchThrottle.set(key, now);

  await createNotification(
    ownerId,
    'page_mismatch',
    'Ad space placeholder found on the wrong page',
    `"${categoryName}" is set to show on "${expectedPath}", but its placeholder div was just found on "${actualPath}" instead. The ad was not shown there. Move the div to the right page, or change the space's target page in the dashboard.`,
    { categoryId, expectedPath, actualPath },
  );
}

module.exports = { addSseClient, removeSseClient, broadcastUnreadCount, createNotification, notifyDomainMismatch, notifyPageMismatch };
