require('dotenv').config();
const { query } = require('../config/db');

async function run() {
  try {
    console.log('Adding handler and occupation columns to users table...');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS handler TEXT UNIQUE;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT;`);
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
