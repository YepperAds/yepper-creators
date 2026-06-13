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

module.exports = { addSseClient, removeSseClient, broadcastUnreadCount, createNotification };
