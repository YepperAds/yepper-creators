'use strict';

// Migration: drop foreign key constraints on owner_id in ad_categories and websites
// These tables are used by both `users` and `creators` (different tables with
// different ID formats). The FK to users(id) blocks Creators from inserting rows.

const { query } = require('../config/db');

async function up() {
  const steps = [
    // Find and drop the FK on ad_categories.owner_id → users(id)
    `DO $$ DECLARE r RECORD;
     BEGIN
       FOR r IN
         SELECT conname FROM pg_constraint
         WHERE conrelid = 'ad_categories'::regclass
           AND contype = 'f'
           AND confrelid = 'users'::regclass
           AND conkey @> ARRAY[(
             SELECT attnum FROM pg_attribute
             WHERE attrelid = 'ad_categories'::regclass AND attname = 'owner_id'
           )]
       LOOP
         EXECUTE 'ALTER TABLE ad_categories DROP CONSTRAINT IF EXISTS ' || r.conname;
       END LOOP;
     END $$`,

    // Find and drop the FK on websites.owner_id → users(id)
    `DO $$ DECLARE r RECORD;
     BEGIN
       FOR r IN
         SELECT conname FROM pg_constraint
         WHERE conrelid = 'websites'::regclass
           AND contype = 'f'
           AND confrelid = 'users'::regclass
           AND conkey @> ARRAY[(
             SELECT attnum FROM pg_attribute
             WHERE attrelid = 'websites'::regclass AND attname = 'owner_id'
           )]
       LOOP
         EXECUTE 'ALTER TABLE websites DROP CONSTRAINT IF EXISTS ' || r.conname;
       END LOOP;
     END $$`,

    // Also drop FK on ad_categories.website_id → websites(id) if types differ
    // (UUID → TEXT FK would fail to create anyway, but clean up if it exists)
    `ALTER TABLE ad_categories DROP CONSTRAINT IF EXISTS ad_categories_website_id_fkey`,
  ];

  for (const sql of steps) {
    try {
      await query(sql);
      console.log('Step applied OK');
    } catch (err) {
      console.warn('Step skipped (may already be gone):', err.message?.split('\n')[0]);
    }
  }
  console.log('Migration 20260612_drop_owner_fk_constraints applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { up };
