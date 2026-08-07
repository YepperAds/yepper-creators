// AdPromoter/models/CreateWebsiteModel.js (PostgreSQL)
const { query } = require('../../config/db');

const Website = {
  async create(data) {
    const { rows } = await query(
      `INSERT INTO websites (owner_id, website_name, website_link, image_url, business_categories,
        is_business_categories_selected, monthly_traffic, traffic_tier, site_script,
        verification_token, verification_status, pages)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [String(data.ownerId), data.websiteName, data.websiteLink, data.imageUrl||null,
       data.businessCategories||[], data.isBusinessCategoriesSelected||false,
       data.monthlyTraffic||0, data.trafficTier||'unverified', data.siteScript||null,
       data.verificationToken||null, data.verificationStatus||'pending',
       JSON.stringify(data.pages||[])]
    );
    return rows[0];
  },
  async findById(id) {
    const { rows } = await query(`SELECT * FROM websites WHERE id = $1`, [id]);
    return rows[0] || null;
  },
  async findByOwner(ownerId) {
    const { rows } = await query(`SELECT * FROM websites WHERE owner_id = $1 ORDER BY created_at DESC`, [String(ownerId)]);
    return rows;
  },
  async findByLink(link) {
    const { rows } = await query(`SELECT * FROM websites WHERE website_link = $1`, [link]);
    return rows[0] || null;
  },
  async findAll() {
    const { rows } = await query(`SELECT * FROM websites ORDER BY created_at DESC`);
    return rows;
  },
  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return this.findById(id);
    const setClauses = keys.map((k,i) => `${toSnake(k)} = $${i+2}`).join(', ');
    // JSON columns (e.g. pages) need an explicit stringify — pg's default JS
    // array/object binding assumes a native Postgres array/composite type,
    // which errors against a jsonb column. business_categories (a genuine
    // TEXT[] column) is the only array-valued field passed through here today
    // and isn't affected: plain string arrays serialize fine either way, but
    // to be safe only jsonb-destined values (plain objects, or arrays of
    // objects) get stringified — a TEXT[] of strings passes through as-is.
    const vals = keys.map(k => {
      const v = fields[k];
      const isJsonb = v !== null && typeof v === 'object' && !(Array.isArray(v) && v.every(el => typeof el !== 'object'));
      return isJsonb ? JSON.stringify(v) : v;
    });
    const { rows } = await query(
      `UPDATE websites SET ${setClauses} WHERE id = $1 RETURNING *`,
      [id, ...vals]
    );
    return rows[0] || null;
  },
  async delete(id) { await query(`DELETE FROM websites WHERE id = $1`, [id]); },
};
function toSnake(s){ return s.replace(/[A-Z]/g,c=>`_${c.toLowerCase()}`); }

function toCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
module.exports = Website;
