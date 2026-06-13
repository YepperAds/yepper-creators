"use strict";

const { query } = require('../config/db');

async function up() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS creators (
       id SERIAL PRIMARY KEY,
       google_id VARCHAR(255) UNIQUE,
       email VARCHAR(255) UNIQUE NOT NULL,
       full_name VARCHAR(255),
       avatar TEXT,
       username VARCHAR(50) UNIQUE NOT NULL,
       what_they_do VARCHAR(100),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     )`,
    // Ensure columns exist (idempotent)
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS what_they_do VARCHAR(100)`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260611_add_creators_profile_fields applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
