'use strict';

// Admin-curated bundles of YouTube ad slots + website ad categories, sold as
// one fixed-price package (see md Plans / Hot Deals). Reuses the same
// pricing lookups, wallet/Flutterwave machinery, and claim/import_ads tables
// the standalone YouTube-claim and website-ad flows already use — buying a
// deal just substitutes the admin's snapshotted deal_price for the live
// system price at finalize time, and never touches either platform's normal
// pricing/listing.

const { query, getClient } = require('../config/db');
const Creator = require('../creators/models/Creator');
const Website = require('../AdPromoter/models/CreateWebsiteModel');
const AdCategory = require('../AdPromoter/models/CreateCategoryModel');
const Payment = require('../AdOwner/models/PaymentModel');
const { Wallet } = require('../AdPromoter/models/walletModel');
const {
  generateFlutterwavePaymentUrl,
  verifyFlutterwaveTransaction,
  upsertWallet,
  generateUniqueTransactionRef,
} = require('../AdOwner/controllers/PaymentController');
const { priceFor } = require('../creators/utils/youtubeTierPricing');
const { validateBusinessCategories } = require('../creators/utils/businessCategories');
const { getSessionUserId, uploadCreativeToCloudinary, SLOT_TYPES } = require('../creators/controllers/adSpaceController');
const sendEmailNotification = require('./emailService');

const CREATOR_SHARE = 0.70; // creator keeps 70% of the deal price, Yepper takes the rest
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Deal email — mirrors the on-site Hot Deal card ──────────────────────────
// Same visual identity as HotDealsSection.tsx/HotDealPlatformCard.tsx (dark
// photo banner, white price panel, platform tiles, "Pick the package"
// button) so a recipient recognizes it as the exact same deal they'd see in
// the app, rather than a generic "here's a link" notice.

// Kept in sync with app/_lib/business-categories.ts's `image` field by hand —
// the frontend module is TypeScript and lives in a separate deployable, so it
// can't be `require()`d from this Node backend directly.
const CATEGORY_META = {
  'technology':        { label: 'Technology',          image: '/category-photos/technology.jpg' },
  'food-beverage':     { label: 'Food & Beverage',     image: '/category-photos/food-beverage.jpg' },
  'real-estate':       { label: 'Real Estate',         image: '/category-photos/real-estate.jpg' },
  'automotive':        { label: 'Automotive',          image: '/category-photos/automotive.jpg' },
  'health-wellness':   { label: 'Health & Wellness',   image: '/category-photos/health-wellness.jpg' },
  'entertainment':     { label: 'Entertainment',       image: '/category-photos/entertainment.jpg' },
  'fashion':           { label: 'Fashion',              image: '/category-photos/fashion.png' },
  'education':         { label: 'Education',           image: '/category-photos/education.jpg' },
  'business-services': { label: 'Business Services',   image: '/category-photos/business-services.jpg' },
  'travel-tourism':    { label: 'Travel & Tourism',    image: '/category-photos/travel-tourism.jpg' },
  'arts-culture':      { label: 'Arts & Culture',      image: '/category-photos/arts-culture.jpg' },
  'photography':       { label: 'Photography',         image: '/category-photos/photography.jpg' },
  'gifts-events':      { label: 'Gifts & Events',      image: '/category-photos/gifts-events.jpg' },
  'government-public': { label: 'Government & Public', image: '/category-photos/government-public.jpg' },
  'general-retail':    { label: 'General Retail',      image: '/category-photos/general-retail.jpg' },
};
function getCategoryMeta(id) {
  return CATEGORY_META[id] || { label: id || 'Others', isIcon: true };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Only allow http(s) URLs through into `src`/`background` attributes — avatar
// and website image URLs ultimately come from user-entered profile/site
// data, not a trusted source.
function safeImageUrl(url) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function getDomain(link) {
  try {
    const url = new URL(link && link.startsWith('http') ? link : `https://${link}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return link || '';
  }
}

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

// Resolves the real website/creator behind a deal item, same data the
// on-site platform tiles show (see HotDealPlatformCard.tsx) — a domain for
// website items, or a channel name + avatar + subscriber count for YouTube
// items.
async function resolveItemDisplay(item) {
  if (item.itemType === 'youtube' && item.creatorId) {
    const creator = await Creator.findById(item.creatorId);
    if (!creator) return null;
    const scRes = await query(
      `SELECT username AS channel_name, followers_count FROM social_connections WHERE creator_id = $1 AND provider = 'youtube' LIMIT 1`,
      [item.creatorId],
    );
    const sc = scRes.rows[0] || {};
    return {
      type: 'youtube',
      name: sc.channel_name || creator.full_name || 'Creator',
      avatar: safeImageUrl(creator.avatar),
      subscribers: Number(sc.followers_count || 0),
    };
  }
  if (item.itemType === 'website' && item.websiteId) {
    const website = await Website.findById(item.websiteId);
    if (!website) return null;
    return { type: 'website', domain: getDomain(website.website_link) };
  }
  return null;
}

function buildTileHtml(display) {
  if (!display) return '';
  if (display.type === 'youtube') {
    const avatarImg = display.avatar
      ? `<img src="${display.avatar}" width="22" height="22" alt="" style="display:block;border-radius:50%;" />`
      : `<div style="width:22px;height:22px;border-radius:50%;background:#e5e5e5;"></div>`;
    return `
      <div style="display:inline-block;width:130px;vertical-align:top;text-align:left;margin:0 6px 12px;font-size:12px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="width:26px;">${avatarImg}</td>
          <td style="padding-left:6px;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px;">${escapeHtml(display.name)}</p>
            <p style="margin:0;font-size:9px;color:rgba(0,0,0,0.55);">${formatCount(display.subscribers)} subscribers</p>
          </td>
        </tr></table>
        <div style="margin-top:6px;height:64px;border-radius:10px;background-color:#111;border:2px solid rgba(255,0,0,0.25);"></div>
      </div>`;
  }
  return `
    <div style="display:inline-block;width:130px;vertical-align:top;text-align:left;margin:0 6px 12px;font-size:12px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#0284c7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${escapeHtml(display.domain)}</p>
      <div style="height:64px;border-radius:10px;background-color:#38bdf8;"></div>
    </div>`;
}

async function buildDealEmailHtml(deal, title, description, link) {
  const savings = deal.items.reduce((s, i) => s + (i.systemPrice - i.dealPrice), 0);
  const originalPrice = deal.totalPrice + savings;
  const pctOff = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  const category = getCategoryMeta(deal.businessCategory);
  const categoryImageUrl = category.isIcon ? null : `${FRONTEND_URL}${category.image}`;

  const displays = await Promise.all(deal.items.map(resolveItemDisplay));
  const tilesHtml = displays.filter(Boolean).map(buildTileHtml).join('');

  const bannerAttrs = categoryImageUrl
    ? `background="${categoryImageUrl}" bgcolor="#111318" style="background-image:url('${categoryImageUrl}');background-size:cover;background-position:center;"`
    : `bgcolor="#111318"`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;"><tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,0.08);overflow:hidden;">
          <tr><td style="background:#000;padding:28px 40px;"><h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Yepper</h1></td></tr>

          <tr><td style="padding:32px 40px 0;">

            <!-- ── Hot Deal card — same layout as the on-site card ── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;border:1px solid #eee;">

              <!-- Banner: category photo + dark tint + badges + title -->
              <tr><td ${bannerAttrs} style="padding:14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td style="background-color:rgba(0,0,0,0.55);border-radius:10px;padding:12px 14px;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td valign="top">
                        <span style="display:inline-block;background:#E8472B;color:#fff;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:99px;margin-bottom:6px;">🔥 Hot deal</span><br/>
                        <span style="font-size:15px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:#facc15;">${escapeHtml(category.label)}</span>
                      </td>
                      ${pctOff > 0 ? `<td valign="top" align="right"><span style="display:inline-block;background:#E8472B;color:#fff;font-size:10px;font-weight:800;padding:4px 10px;border-radius:99px;white-space:nowrap;">Save ${pctOff}%</span></td>` : ''}
                    </tr></table>
                    <p style="margin:10px 0 0;font-size:13px;font-weight:700;color:#fff;">${escapeHtml(title)}</p>
                  </td>
                </tr></table>
              </td></tr>

              <!-- Price panel -->
              <tr><td style="background:#fff;padding:16px;">
                <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:12px;">
                  ${savings > 0 ? `<span style="font-size:12px;color:rgba(0,0,0,0.4);text-decoration:line-through;margin-right:6px;">${originalPrice.toLocaleString()} RWF</span>` : ''}
                  <span style="font-size:13px;color:#000;">Only on <strong style="font-size:15px;">${deal.totalPrice.toLocaleString()} RWF</strong></span>
                  ${savings > 0 ? `<span style="display:inline-block;margin-left:8px;background:#E8472B;color:#fff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:99px;">Save ${savings.toLocaleString()} RWF</span>` : ''}
                </td></tr></table>

                ${tilesHtml ? `<div style="text-align:center;font-size:0;">${tilesHtml}</div>` : ''}
              </td></tr>
            </table>

            ${description ? `<p style="color:#555;font-size:14px;line-height:1.6;margin:20px 0 0;">${escapeHtml(description)}</p>` : ''}

            <!-- CTA — same label as the on-site "Pick the package" button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td align="center">
              <a href="${link}" style="display:inline-block;background:#fff;color:#000;border:1px solid #000;padding:16px 36px;text-decoration:none;font-weight:800;font-size:15px;border-radius:99px;">
                Pick the package →
              </a>
            </td></tr></table>
            <p style="color:#999;font-size:13px;line-height:1.5;margin:0 0 32px;text-align:center;">
              Clicking the button takes you straight to this deal — log in (or create an account) and you'll land right back here to finish claiming it.
            </p>
          </td></tr>

          <tr><td style="background:#fafafa;border-top:1px solid #eee;padding:20px 40px;">
            <p style="color:#bbb;font-size:12px;margin:0;text-align:center;">
              © ${new Date().getFullYear()} Yepper · <a href="${FRONTEND_URL}/privacy-policy" style="color:#bbb;">Privacy Policy</a>
            </p>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// ── mapping helpers ─────────────────────────────────────────────────────────
function mapDeal(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    businessCategory: row.business_category,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    soldAt: row.sold_at,
    createdAt: row.created_at,
  };
}

function mapItem(row) {
  return {
    id: row.id,
    itemType: row.item_type,
    creatorId: row.creator_id,
    slotType: row.slot_type,
    durationBand: row.duration_band,
    adType: row.ad_type,
    tier: row.tier,
    websiteId: row.website_id,
    categoryId: row.category_id,
    systemPrice: parseFloat(row.system_price),
    dealPrice: parseFloat(row.deal_price),
  };
}

async function loadDealWithItems(dealId) {
  const dealRes = await query(`SELECT * FROM hot_deals WHERE id = $1`, [dealId]);
  if (!dealRes.rowCount) return null;
  const itemsRes = await query(`SELECT * FROM hot_deal_items WHERE hot_deal_id = $1 ORDER BY created_at ASC`, [dealId]);
  const items = itemsRes.rows.map(mapItem);
  return { ...mapDeal(dealRes.rows[0]), items, totalPrice: items.reduce((s, i) => s + i.dealPrice, 0) };
}

// ── system-price lookups (single source of truth — never trust the client) ──
async function resolveYoutubeSystemPrice(creatorId, durationBand) {
  const creatorRes = await query(`SELECT ad_type_preference FROM creators WHERE id = $1`, [creatorId]);
  if (!creatorRes.rowCount) throw httpError(404, 'Creator not found');
  const adType = creatorRes.rows[0].ad_type_preference || 'corner';

  const subsRes = await query(
    `SELECT followers_count FROM social_connections WHERE creator_id = $1 AND provider = 'youtube' LIMIT 1`,
    [creatorId],
  );
  const subscribers = Number(subsRes.rows[0]?.followers_count || 0);
  const priced = priceFor(subscribers, durationBand, adType);
  if (!priced) throw httpError(400, 'Invalid duration band');
  return { systemPrice: priced.amount, adType, tier: priced.tier, subscribers };
}

async function resolveWebsiteSystemPrice(categoryId) {
  const category = await AdCategory.findById(categoryId);
  if (!category) throw httpError(404, 'Ad category not found');
  return { systemPrice: parseFloat(category.price), websiteId: category.website_id };
}

async function buildItemRow(item) {
  if (item.itemType === 'youtube') {
    if (!SLOT_TYPES.includes(item.slotType)) throw httpError(400, 'Invalid slot type');
    const { systemPrice, adType, tier } = await resolveYoutubeSystemPrice(item.creatorId, item.durationBand);
    return {
      item_type: 'youtube', creator_id: item.creatorId, slot_type: item.slotType,
      duration_band: item.durationBand, ad_type: adType, tier, website_id: null, category_id: null,
      system_price: systemPrice, deal_price: item.dealPrice != null ? Number(item.dealPrice) : systemPrice,
    };
  }
  if (item.itemType === 'website') {
    if (!item.categoryId) throw httpError(400, 'categoryId is required for website items');
    const { systemPrice, websiteId } = await resolveWebsiteSystemPrice(item.categoryId);
    return {
      item_type: 'website', creator_id: null, slot_type: null, duration_band: null, ad_type: null, tier: null,
      website_id: websiteId, category_id: item.categoryId,
      system_price: systemPrice, deal_price: item.dealPrice != null ? Number(item.dealPrice) : systemPrice,
    };
  }
  throw httpError(400, 'itemType must be "youtube" or "website"');
}

async function insertItemRows(dealId, rows) {
  for (const r of rows) {
    await query(
      `INSERT INTO hot_deal_items (hot_deal_id, item_type, creator_id, slot_type, duration_band, ad_type, tier, website_id, category_id, system_price, deal_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [dealId, r.item_type, r.creator_id, r.slot_type, r.duration_band, r.ad_type, r.tier, r.website_id, r.category_id, r.system_price, r.deal_price],
    );
  }
}

// ── Admin: CRUD ──────────────────────────────────────────────────────────────

// POST /api/admin/hot-deals
exports.adminCreateDeal = async (req, res) => {
  try {
    const { title, description, businessCategory, coverImageUrl, status, items } = req.body;
    if (!title || !businessCategory) return res.status(400).json({ success: false, message: 'Title and business category are required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'At least one item is required' });
    if (status !== undefined && !['draft', 'active', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const rows = [];
    for (const item of items) rows.push(await buildItemRow(item));

    const dealRes = await query(
      `INSERT INTO hot_deals (title, description, business_category, cover_image_url, status, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'draft'),$6) RETURNING id`,
      [title, description || null, businessCategory, coverImageUrl || null, status || null, req.admin?.username || null],
    );
    await insertItemRows(dealRes.rows[0].id, rows);

    return res.status(201).json({ success: true, data: await loadDealWithItems(dealRes.rows[0].id) });
  } catch (err) {
    console.error('[hotDeals] adminCreateDeal error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to create deal' });
  }
};

// PUT /api/admin/hot-deals/:id
exports.adminUpdateDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT sold_at FROM hot_deals WHERE id = $1`, [id]);
    if (!existing.rowCount) return res.status(404).json({ success: false, message: 'Deal not found' });
    if (existing.rows[0].sold_at) return res.status(409).json({ success: false, message: 'This deal has already been sold and can no longer be edited' });

    const { title, description, businessCategory, coverImageUrl, status, items } = req.body;

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'At least one item is required' });
      const rows = [];
      for (const item of items) rows.push(await buildItemRow(item));
      await query(`DELETE FROM hot_deal_items WHERE hot_deal_id = $1`, [id]);
      await insertItemRows(id, rows);
    }

    const vals = [];
    const sets = [];
    const setField = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    if (title !== undefined) setField('title', title);
    if (description !== undefined) setField('description', description);
    if (businessCategory !== undefined) setField('business_category', businessCategory);
    if (coverImageUrl !== undefined) setField('cover_image_url', coverImageUrl);
    if (status !== undefined) {
      if (!['draft', 'active', 'archived'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
      setField('status', status);
    }
    if (sets.length) {
      vals.push(id);
      await query(`UPDATE hot_deals SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
    }

    return res.json({ success: true, data: await loadDealWithItems(id) });
  } catch (err) {
    console.error('[hotDeals] adminUpdateDeal error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to update deal' });
  }
};

// GET /api/admin/hot-deals
exports.adminListDeals = async (req, res) => {
  try {
    const dealsRes = await query(`SELECT * FROM hot_deals ORDER BY created_at DESC`);
    const data = await Promise.all(dealsRes.rows.map(async (d) => {
      const itemsRes = await query(`SELECT * FROM hot_deal_items WHERE hot_deal_id = $1`, [d.id]);
      const items = itemsRes.rows.map(mapItem);
      return { ...mapDeal(d), itemCount: items.length, totalPrice: items.reduce((s, i) => s + i.dealPrice, 0) };
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hotDeals] adminListDeals error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load deals' });
  }
};

// GET /api/admin/hot-deals/:id
exports.adminGetDeal = async (req, res) => {
  try {
    const deal = await loadDealWithItems(req.params.id);
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    return res.json({ success: true, data: deal });
  } catch (err) {
    console.error('[hotDeals] adminGetDeal error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load deal' });
  }
};

// DELETE /api/admin/hot-deals/:id
exports.adminDeleteDeal = async (req, res) => {
  try {
    const existing = await query(`SELECT sold_at FROM hot_deals WHERE id = $1`, [req.params.id]);
    if (!existing.rowCount) return res.status(404).json({ success: false, message: 'Deal not found' });
    if (existing.rows[0].sold_at) return res.status(409).json({ success: false, message: 'Cannot delete a sold deal' });
    await query(`DELETE FROM hot_deals WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[hotDeals] adminDeleteDeal error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete deal' });
  }
};

// POST /api/admin/hot-deals/:id/send-email — emails a specific person a link
// straight to this deal. `/?dealId=` is read by HotDealsSection wherever it's
// rendered (logged-out home feed and the logged-in dashboard alike — see
// app/_components/home/HotDealsSection.tsx) and auto-opens the purchase
// modal, so the recipient lands directly on "claim this deal" either way.
exports.adminSendDealEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, title, description } = req.body;
    if (!email || !String(email).trim()) return res.status(400).json({ success: false, message: 'Recipient email is required' });
    if (!title || !String(title).trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const deal = await loadDealWithItems(id);
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });

    const link = `${FRONTEND_URL}/?dealId=${deal.id}`;
    const html = await buildDealEmailHtml(deal, String(title).trim(), description ? String(description).trim() : '', link);

    const result = await sendEmailNotification(String(email).trim(), title, html);
    if (result && result.skipped) {
      return res.status(503).json({ success: false, message: 'Email sending is not configured on this server' });
    }
    return res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    console.error('[hotDeals] adminSendDealEmail error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};

// GET /api/admin/hot-deals/youtube-price-preview?creatorId=&durationBand=
exports.adminYoutubePricePreview = async (req, res) => {
  try {
    const { creatorId, durationBand } = req.query;
    if (!creatorId || !durationBand) return res.status(400).json({ success: false, message: 'creatorId and durationBand are required' });
    const { systemPrice, adType, tier, subscribers } = await resolveYoutubeSystemPrice(creatorId, durationBand);
    return res.json({ success: true, data: { systemPrice, adType, tier, subscribers } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to load price preview' });
  }
};

// ── Public ───────────────────────────────────────────────────────────────────

// GET /api/hot-deals
exports.getPublicHotDeals = async (req, res) => {
  try {
    const dealsRes = await query(`SELECT * FROM hot_deals WHERE status = 'active' AND sold_at IS NULL ORDER BY created_at DESC`);
    const data = await Promise.all(dealsRes.rows.map(async (d) => {
      const itemsRes = await query(`SELECT * FROM hot_deal_items WHERE hot_deal_id = $1`, [d.id]);
      const items = itemsRes.rows.map(mapItem);
      return { ...mapDeal(d), items, totalPrice: items.reduce((s, i) => s + i.dealPrice, 0) };
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[hotDeals] getPublicHotDeals error:', err);
    return res.status(500).json({ success: false, data: [] });
  }
};

// ── Purchase (all-or-nothing, one checkout) ─────────────────────────────────

// Runs the actual claim/booking + payout for every bundled item inside one
// transaction, gated by an atomic claim on hot_deals.sold_at so two
// simultaneous buyers can't both win the same deal. Returns per-item payment
// rows are written by the caller afterward (so the gateway-path summary
// payment row, created at initiate time, can be UPDATEd to 'successful'
// instead of colliding with a freshly INSERTed one here).
async function finalizeHotDealPurchase({ deal, advertiserId, checkoutInfo, walletApplied, tx_ref, walletId }) {
  const advertiser = await Creator.findById(advertiserId);
  const advertiserEmail = advertiser?.email || '';
  const itemResults = [];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const claimed = await client.query(`UPDATE hot_deals SET sold_at = NOW() WHERE id = $1 AND sold_at IS NULL RETURNING id`, [deal.id]);
    if (!claimed.rowCount) {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, message: 'This deal was just purchased by someone else' };
    }

    if (walletApplied > 0 && walletId) {
      await client.query(
        `UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1, last_updated = NOW() WHERE id = $2`,
        [walletApplied, walletId],
      );
    }

    for (const item of deal.items) {
      if (item.itemType === 'youtube') {
        const creatorEarnings = Math.round(item.dealPrice * CREATOR_SHARE);
        const yepperCut = item.dealPrice - creatorEarnings;
        const claimRes = await client.query(
          `INSERT INTO youtube_ad_claims (creator_id, advertiser_id, slot_type, image_url, ad_type, ad_size,
             duration_band, tier, amount, creator_earnings, yepper_cut, currency,
             business_categories, business_category_other, tx_ref, payment_status)
           VALUES ($1,$2,$3,$4,$5,'medium',$6,$7,$8,$9,$10,'RWF',$11,$12,$13,'paid') RETURNING id`,
          [item.creatorId, String(advertiserId), item.slotType, checkoutInfo.imageUrl, item.adType,
            item.durationBand, item.tier, item.dealPrice, creatorEarnings, yepperCut,
            JSON.stringify(checkoutInfo.businessCategories), checkoutInfo.businessCategoryOther || null, `${tx_ref}_${item.id}`],
        );
        if (creatorEarnings > 0) {
          await upsertWallet(client, String(item.creatorId), 'webOwner', null, creatorEarnings, creatorEarnings, 0);
        }
        itemResults.push({ item, claimId: claimRes.rows[0].id, webOwnerId: String(item.creatorId) });
      } else {
        const category = await AdCategory.findById(item.categoryId);
        const website = await Website.findById(item.websiteId);
        const rejectionDeadline = new Date(Date.now() + 2 * 60 * 1000);
        const websiteSelections = [{
          websiteId: item.websiteId, categories: [item.categoryId],
          approved: true, approvedAt: new Date().toISOString(), publishedAt: new Date().toISOString(),
          status: 'active', rejectionDeadline: rejectionDeadline.toISOString(), isRejected: false,
        }];
        const adRes = await client.query(
          `INSERT INTO import_ads (user_id, ad_owner_email, image_url, business_name, business_link,
             business_location, ad_description, website_selections, confirmed, clicks, views,
             available_for_reassignment, business_categories, business_category_other)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,0,0,false,$9,$10) RETURNING id`,
          [String(advertiserId), advertiserEmail, checkoutInfo.imageUrl, checkoutInfo.businessName,
            checkoutInfo.businessLink, checkoutInfo.businessLocation, checkoutInfo.adDescription,
            JSON.stringify(websiteSelections), JSON.stringify(checkoutInfo.businessCategories), checkoutInfo.businessCategoryOther || null],
        );
        const adId = adRes.rows[0].id;

        await client.query(
          `UPDATE ad_categories SET selected_ads = array_append(COALESCE(selected_ads, ARRAY[]::uuid[]), $1)
           WHERE id = $2 AND NOT ($1 = ANY(COALESCE(selected_ads, ARRAY[]::uuid[])))`,
          [adId, item.categoryId],
        );

        if (item.dealPrice > 0) {
          await upsertWallet(client, website.owner_id, 'webOwner', category?.web_owner_email || null, item.dealPrice, item.dealPrice, 0);
        }

        itemResults.push({ item, adId, webOwnerId: website.owner_id, websiteId: item.websiteId, categoryId: item.categoryId });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // One of the bundled YouTube slots got claimed by someone else (via the
    // regular claim flow or another deal) between checkout and payment —
    // same race the direct claim flow already handles in
    // youtubeClaimPaymentController.js. Surface it the same way instead of
    // letting it bubble up as an uncaught 500 that leaves the Payment row
    // stuck in 'pending' forever.
    if (err.code === '23505' && err.constraint === 'youtube_ad_claims_open_slot') {
      return { ok: false, status: 409, message: 'One of the YouTube slots in this deal was just claimed by someone else' };
    }
    throw err;
  } finally {
    client.release();
  }

  for (const r of itemResults) {
    await Payment.create({
      paymentId: `${tx_ref}_${r.item.id}`, tx_ref: `${tx_ref}_${r.item.id}`, baseReference: tx_ref,
      adId: r.adId || null, advertiserId: String(advertiserId), webOwnerId: r.webOwnerId,
      websiteId: r.websiteId || null, categoryId: r.categoryId || null,
      amount: r.item.dealPrice, currency: 'RWF', status: 'successful',
      walletApplied: 0, amountPaid: 0, paymentMethod: 'wallet_only',
      metadata: { kind: 'hot_deal_item', dealId: deal.id, itemId: r.item.id, itemType: r.item.itemType, claimId: r.claimId || null },
      paidAt: new Date(),
    });
  }

  return { ok: true };
}

// POST /api/hot-deals/:id/purchase — multipart form
exports.initiatePurchase = async (req, res) => {
  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Log in to buy this deal' });

  const { id: dealId } = req.params;
  const { businessName, businessLink, businessLocation, adDescription, businessCategoryOther } = req.body;
  if (!req.file) return res.status(400).json({ success: false, message: 'No ad creative uploaded' });
  if (!businessName) return res.status(400).json({ success: false, message: 'Business name is required' });

  let businessCategories;
  try {
    businessCategories = JSON.parse(req.body.businessCategories || '[]');
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid businessCategories' });
  }
  const categoryError = validateBusinessCategories(businessCategories, businessCategoryOther);
  if (categoryError) return res.status(400).json({ success: false, message: categoryError });

  try {
    const deal = await loadDealWithItems(dealId);
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    if (deal.status !== 'active' || deal.soldAt) return res.status(409).json({ success: false, message: 'This deal is no longer available' });

    const totalCost = deal.totalPrice;
    const advertiser = await Creator.findById(advertiserId);
    const wallet = await Wallet.findByOwner(String(advertiserId), 'advertiser');
    const walletBalance = wallet ? parseFloat(wallet.balance) : 0;
    const walletToUse = Math.min(walletBalance, totalCost);
    const remainingAmount = totalCost - walletToUse;

    const imageUrl = await uploadCreativeToCloudinary(req.file);
    const checkoutInfo = {
      businessName, businessLink: businessLink || null, businessLocation: businessLocation || null,
      adDescription: adDescription || null, businessCategories, businessCategoryOther: businessCategoryOther || null,
      imageUrl,
    };

    if (remainingAmount <= 0.01) {
      const tx_ref = generateUniqueTransactionRef('hot_deal_wallet', advertiserId, dealId);
      const result = await finalizeHotDealPurchase({ deal, advertiserId, checkoutInfo, walletApplied: walletToUse, tx_ref, walletId: wallet?.id });
      if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

      await Payment.create({
        paymentId: tx_ref, tx_ref, baseReference: tx_ref,
        advertiserId: String(advertiserId), webOwnerId: 'hot_deal',
        amount: totalCost, currency: 'RWF', status: 'successful',
        walletApplied: walletToUse, amountPaid: 0, paymentMethod: 'wallet_only',
        metadata: { kind: 'hot_deal', dealId },
        paidAt: new Date(),
      });

      return res.status(200).json({ success: true, allPaid: true, totalCost, walletApplied: walletToUse, dealId });
    }

    const tx_ref = generateUniqueTransactionRef('hot_deal_flw', advertiserId, dealId);
    await Payment.create({
      paymentId: tx_ref, tx_ref, baseReference: tx_ref,
      advertiserId: String(advertiserId), webOwnerId: 'hot_deal',
      amount: totalCost, currency: 'RWF', status: 'pending',
      flutterwaveData: null, walletApplied: walletToUse, amountPaid: remainingAmount,
      paymentMethod: walletToUse > 0 ? 'wallet_hybrid' : 'flutterwave',
      metadata: { kind: 'hot_deal', dealId, checkoutInfo, walletApplied: walletToUse },
    });

    const paymentUrl = await generateFlutterwavePaymentUrl({
      tx_ref, amount: remainingAmount,
      redirectPath: '/hot-deal-payment-callback',
      customer: { email: advertiser?.email, name: advertiser?.full_name || 'Advertiser' },
      customizations: { description: `Hot Deal — ${deal.title}` },
    });

    return res.status(200).json({
      success: true, allPaid: false, totalCost,
      walletApplied: walletToUse, amountPaid: remainingAmount,
      paymentUrl, tx_ref, dealId,
    });
  } catch (err) {
    console.error('[hotDeals] initiatePurchase error:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate purchase' });
  }
};

// POST /api/hot-deals/verify-callback
exports.verifyPurchase = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;
    const identifier = transaction_id || tx_ref;
    if (!identifier) return res.status(400).json({ success: false, message: 'Transaction reference required' });

    let payment = tx_ref ? await Payment.findByTxRef(tx_ref) : null;
    if (!payment && transaction_id) payment = await Payment.findByPaymentId(String(transaction_id));
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });
    if (payment.metadata?.kind !== 'hot_deal') return res.status(400).json({ success: false, message: 'Not a Hot Deal payment' });
    if (payment.status === 'successful') return res.status(200).json({ success: true, message: 'Payment already processed' });

    const flwResponse = await verifyFlutterwaveTransaction(identifier);
    const flwData = flwResponse.data;

    if (flwResponse.status === 'success' && flwData?.status === 'successful') {
      const deal = await loadDealWithItems(payment.metadata.dealId);
      if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });

      const wallet = await Wallet.findByOwner(payment.advertiser_id, 'advertiser');
      const walletApplied = parseFloat(payment.wallet_applied || 0);

      const result = await finalizeHotDealPurchase({
        deal, advertiserId: payment.advertiser_id, checkoutInfo: payment.metadata.checkoutInfo,
        walletApplied, tx_ref: payment.tx_ref, walletId: wallet?.id,
      });

      if (!result.ok) {
        await Payment.update(payment.id, { status: 'failed' });
        return res.status(result.status).json({ success: false, message: result.message });
      }

      await Payment.update(payment.id, { status: 'successful', paidAt: new Date(), flutterwaveData: flwData });
      return res.status(200).json({ success: true, message: 'Payment verified — deal claimed.' });
    }

    await Payment.update(payment.id, { status: 'failed' });
    return res.status(400).json({ success: false, message: 'Payment verification failed', details: flwData });
  } catch (err) {
    console.error('[hotDeals] verifyPurchase error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};
