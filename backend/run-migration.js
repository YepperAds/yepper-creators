// backend/run-migration.js — run once, then delete
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/db');

(async () => {
  try {
    const file = path.join(__dirname, 'migrations', '001_pricing_tables.sql');
    const sql = fs.readFileSync(file, 'utf8');
    await pool.query(sql);
    console.log('✅ pricing_rules + pricing_settings created & seeded');
  } catch (e) {
    console.error('❌ migration failed:', e.message);
  } finally {
    await pool.end();
    process.exit();
  }
})();