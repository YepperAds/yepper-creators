'use strict';

// Migration: create the pricing tables (pricing_rules + pricing_settings).
// Runs on boot, same pattern as 20260612_drop_owner_fk_constraints.js.
// Idempotent — the SQL uses IF NOT EXISTS / ON CONFLICT DO NOTHING, so running
// it on every startup is safe and does nothing once the tables exist + are seeded.

const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

async function up() {
  // Make sure gen_random_uuid() is available (used by the table defaults).
  try { await query('CREATE EXTENSION IF NOT EXISTS pgcrypto'); } catch (_) { /* ignore if no perms; gen_random_uuid is usually built in */ }

  const sqlPath = path.join(__dirname, '001_pricing_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await query(sql);
}

module.exports = { up };

// Allow manual run too:  node migrations/20260623_pricing_tables.js
if (require.main === module) {
  up()
    .then(() => { console.log('✅ pricing tables ready'); process.exit(0); })
    .catch((err) => { console.error('❌ pricing migration failed:', err.message); process.exit(1); });
}
