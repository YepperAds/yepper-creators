'use strict';

const { query } = require('../../config/db');

const Creator = {
  async findById(id) {
    const { rows } = await query(`SELECT * FROM creators WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] || null;
  },

  async findByGoogleId(googleId) {
    const { rows } = await query(`SELECT * FROM creators WHERE google_id = $1 LIMIT 1`, [googleId]);
    return rows[0] || null;
  },

  async upsertFromGoogle({ googleId, email, fullName, avatar }) {
    const existing = await query(`SELECT id FROM creators WHERE google_id = $1 LIMIT 1`, [googleId]);
    if (existing.rowCount > 0) {
      const id = existing.rows[0].id;
      await query(
        `UPDATE creators SET email=$2, full_name=$3, avatar=$4, updated_at=NOW() WHERE id=$1`,
        [id, email, fullName, avatar],
      );
      return id;
    }
    const ins = await query(
      `INSERT INTO creators (google_id, email, full_name, avatar) VALUES ($1,$2,$3,$4) RETURNING id`,
      [googleId, email, fullName, avatar],
    );
    return ins.rows[0].id;
  },

  async isUsernameAvailable(username) {
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
      `UPDATE creators SET ${setClauses}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, ...keys.map((k) => fields[k])],
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
      [id],
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
       WHERE id=$1`,
      [id],
    );
  },
};

module.exports = Creator;
