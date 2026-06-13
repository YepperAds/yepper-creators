'use strict';

const { query } = require('../../config/db');

const Creator = {
  async findById(id) {
    // Accept either numeric IDs or legacy UUIDs passed in tokens.
    // Compare id as text and also match google_id for safety.
    const { rows } = await query(
      `SELECT * FROM creators WHERE id::text = $1 OR google_id = $1 LIMIT 1`,
      [String(id)],
    );
    return rows[0] || null;
  },

  async findByGoogleId(googleId) {
    const { rows } = await query(`SELECT * FROM creators WHERE google_id = $1 LIMIT 1`, [googleId]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const { rows } = await query(`SELECT * FROM creators WHERE email = $1 LIMIT 1`, [email.toLowerCase().trim()]);
    return rows[0] || null;
  },

  async create({ googleId, email, fullName, avatar }) {
    // Ensure a username exists (schema requires username NOT NULL)
    const base = (email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'user';
    let username = base;
    let suffix = 0;
    while (!(await Creator.isUsernameAvailable(username))) {
      suffix += 1;
      username = `${base}${suffix}`.slice(0, 50);
    }

    const { rows } = await query(
      `INSERT INTO creators (google_id, email, full_name, avatar, username) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [googleId || null, email, fullName || null, avatar || null, username],
    );
    return rows[0] || null;
  },

  async upsertFromGoogle({ googleId, email, fullName, avatar }) {
    const existing = await query(`SELECT id FROM creators WHERE google_id = $1 LIMIT 1`, [googleId]);
    if (existing.rowCount > 0) {
      const id = existing.rows[0].id;
      await query(
        `UPDATE creators SET email=$2, full_name=$3, avatar=$4, updated_at=NOW() WHERE id::text=$1`,
        [String(id), email, fullName, avatar],
      );
      return { id, isNew: false };
    }
    // Ensure username exists for new creator
    const base = (email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'user';
    let username = base;
    let suffix = 0;
    while (!(await Creator.isUsernameAvailable(username))) {
      suffix += 1;
      username = `${base}${suffix}`.slice(0, 50);
    }

    const ins = await query(
      `INSERT INTO creators (google_id, email, full_name, avatar, username) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [googleId, email, fullName, avatar, username],
    );
    return { id: ins.rows[0].id, isNew: true };
  },

  async isUsernameAvailable(username, excludeId = null) {
    if (excludeId) {
      const { rowCount } = await query(
        `SELECT 1 FROM creators WHERE username = $1 AND id::text != $2 LIMIT 1`,
        [username, String(excludeId)],
      );
      return rowCount === 0;
    }
    const { rowCount } = await query(
      `SELECT 1 FROM creators WHERE username = $1 LIMIT 1`,
      [username],
    );
    return rowCount === 0;
  },

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return this.findById(id);
    const toSnake = (str) => str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const setClauses = keys.map((k, i) => `${toSnake(k)} = $${i + 2}`).join(', ');
    const { rows } = await query(
      `UPDATE creators SET ${setClauses}, updated_at=NOW() WHERE id::text=$1 RETURNING *`,
      [String(id), ...keys.map((k) => fields[k])],
    );
    return rows[0] || null;
  },

  async getWebsite(id) {
    const { rows } = await query(
      `SELECT website_name, website_url, website_domain, website_status, website_icon,
              website_traffic, website_tracking_started_at, website_actual_stats_available_at,
              website_verified_at, website_verification_token, website_verification_method,
              website_verification_host, website_verification_value
       FROM creators WHERE id=$1 LIMIT 1`,
      [String(id)],
    );
    return rows[0] || null;
  },

  async clearWebsite(id) {
    await query(
      `UPDATE creators SET
         website_name=NULL, website_url=NULL, website_domain=NULL,
         website_status='not_connected', website_icon=NULL, website_traffic='{}',
         website_verification_token=NULL, website_verification_method=NULL,
         website_verification_host=NULL, website_verification_value=NULL,
         website_tracking_token=NULL, website_tracking_started_at=NULL,
         website_actual_stats_available_at=NULL, website_verified_at=NULL, updated_at=NOW()
       WHERE id::text=$1`,
      [String(id)],
    );
  },
};

module.exports = Creator;
