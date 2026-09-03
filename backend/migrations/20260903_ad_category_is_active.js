'use strict';

// Migration: lets a web owner open/close an ad space from the dashboard.
// Closing it (is_active = FALSE) doesn't remove or hide the placeholder
// div/box on the live site — it keeps reserving that layout space — it just
// stops any ad (or the "Available Advertising Space" filler) from rendering
// inside it. See AdDisplayController.resolveCategoryAndAds and
// SiteScriptController's renderAds/loadSpace for the client-side half.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260903_ad_category_is_active applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };




// 'use strict';

// // Migration: lets a web owner open/close an ad space from the dashboard.
// // Closing it (is_active = FALSE) doesn't remove or hide the placeholder
// // div/box on the live site — it keeps reserving that layout space — it just
// // stops any ad (or the "Available Advertising Space" filler) from rendering
// // inside it. See AdDisplayController.resolveCategoryAndAds and
// // SiteScriptController's renderAds/loadSpace for the client-side half.
// const { query } = require('../config/db');

// async function up() {
//   const statements = [
//     `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,
//   ];

//   for (const s of statements) {
//     try {
//       await query(s);
//     } catch (err) {
//       console.warn('Migration statement skipped:', err.message || err);
//     }
//   }
//   console.log('Migration 20260903_ad_category_is_active applied.');
// }

// if (require.main === module) {
//   up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
// }

// module.exports = { up };
