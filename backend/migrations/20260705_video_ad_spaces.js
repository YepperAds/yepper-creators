'use strict';

// Migration: seed pricing_rules with the 3 new video-player ad spaces
// (Preroll, Midroll, Pause). Runs on boot, same pattern as
// 20260623_pricing_tables.js. Idempotent — ON CONFLICT DO NOTHING.

const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

async function up() {
  const sqlPath = path.join(__dirname, '002_video_ad_spaces.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await query(sql);
}

module.exports = { up };

// Allow manual run too:  node migrations/20260705_video_ad_spaces.js
if (require.main === module) {
  up()
    .then(() => { console.log('✅ video ad-space prices ready'); process.exit(0); })
    .catch((err) => { console.error('❌ video ad-space migration failed:', err.message); process.exit(1); });
}
