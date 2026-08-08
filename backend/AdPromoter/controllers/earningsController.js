// earningsController.js
// Returns earnings estimate for a category based on REAL analytics traffic.
// If analytics cannot be reached or no traffic exists, returns { available: false }.

const AdCategory = require('../models/CreateCategoryModel');
const Website    = require('../models/CreateWebsiteModel');
const PageView   = require('../models/WebsiteAnalyticsModel');
const jwt        = require('jsonwebtoken');
const User       = require('../../models/User');
const Creator    = require('../../creators/models/Creator');

const TRAFFIC_TIERS = [
  { tier: 'starter',  min: 500,    max: 2000,   basePrice: 6000   },
  { tier: 'basic',    min: 2001,   max: 10000,  basePrice: 15000  },
  { tier: 'standard', min: 10001,  max: 50000,  basePrice: 35000  },
  { tier: 'premium',  min: 50001,  max: 200000, basePrice: 80000  },
  { tier: 'elite',    min: 200001, max: Infinity,basePrice: 180000 },
];

const FORMAT_MULTIPLIERS = {
  'header':             1.0,
  'above the fold':     1.0,
  'pro footer':         1.0,
  'profooter':          1.0,
  'beneath title':      1.1,
  'inline content':     1.1,
  'left rail':          1.1,
  'sidebar':            1.3,
  'stickysidebar':      1.3,
  'skyscraper':         1.3,
  'floating':           1.6,
  'modalpic':           1.6,
};

function getTierFromTraffic(v) {
  if (!v || v < 500) return { tier: 'unverified', min: 0, max: 0, basePrice: 0 };
  return TRAFFIC_TIERS.find(t => v >= t.min && v <= t.max) || TRAFFIC_TIERS[0];
}

// Tier (and therefore price) comes purely from real script-tracked traffic —
// same as the tier itself (see analyticsController.trackPageView). No
// separate verification step changes the price: a brand-new site just
// starts at 'unverified' and moves up as real traffic accumulates, the same
// way a new YouTube channel starts at 0 subscribers rather than being
// penalized for not having connected something else first.
function computeEarnings(monthlyTraffic, spaceType) {
  const tier       = getTierFromTraffic(monthlyTraffic);
  const multiplier = FORMAT_MULTIPLIERS[(spaceType || '').toLowerCase()] || 1.0;
  const totalPrice = Math.round(tier.basePrice * multiplier);
  const ownerEarns = Math.round(totalPrice * 0.70);
  const yepperCut  = totalPrice - ownerEarns;
  return { tier: tier.tier, totalPrice, ownerEarns, yepperCut, monthlyTraffic };
}

async function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const creator = await Creator.findById(decoded.userId).catch(() => null);
    if (creator) return creator;
    return await User.findById(decoded.userId).catch(() => null);
  } catch { return null; }
}

// GET /api/ad-categories/earnings/:categoryId
// Returns { available: true, ...earningsData } or { available: false, reason }
exports.getCategoryEarnings = async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const category = await AdCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    if (category.owner_id !== user.id.toString())
      return res.status(403).json({ message: 'Forbidden' });

    const website = await Website.findById(category.website_id);
    if (!website) return res.status(404).json({ message: 'Website not found' });

    // scriptInstalled is the real flag (set on the very first pageview ping
    // ever received, see analyticsController.trackPageView) — not a traffic
    // threshold. A site can have the script correctly installed and running
    // with low traffic; that's a real $0-ish estimate below, not "script
    // not detected".
    if (!website.script_installed) {
      return res.json({
        available: false,
        reason: 'no_script',
        message: 'No traffic detected yet. Install your Yepper script and earnings will appear once visitors are tracked.'
      });
    }

    const monthlyTraffic = website.monthly_traffic || 0;
    const earnings = computeEarnings(monthlyTraffic, category.space_type);
    return res.json({ available: true, ...earnings });

  } catch (err) {
    console.error('getCategoryEarnings error:', err.message);
    res.status(500).json({ message: 'Failed to fetch earnings', error: err.message });
  }
};

// GET /api/websites/:websiteId/earnings-summary
// Returns earnings potential for ALL categories of a website
exports.getWebsiteEarningsSummary = async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const website = await Website.findById(req.params.websiteId);
    if (!website) return res.status(404).json({ message: 'Website not found' });
    if (website.owner_id !== user.id.toString())
      return res.status(403).json({ message: 'Forbidden' });

    const monthlyTraffic = website.monthly_traffic || 0;
    // The real flag (set on the very first pageview ping ever received, see
    // analyticsController.trackPageView) — not a traffic-count guess. This
    // used to be `monthlyTraffic >= 10`, which kept the "install your
    // script" banner showing for a site that had the script correctly
    // installed and rendering ads, just with fewer than 10 tracked visits
    // so far.
    const scriptInstalled = !!website.script_installed;

    const categories = await AdCategory.findByWebsite(req.params.websiteId);

    if (!scriptInstalled) {
      return res.json({
        available: false,
        reason: 'no_script',
        message: 'Install your Yepper script to start tracking traffic. Earnings will appear once visitors are detected.',
        monthlyTraffic: 0,
        scriptInstalled: false,
        categories: categories.map(c => ({ categoryId: c.id, name: c.category_name, available: false }))
      });
    }

    const summary = categories.map(c => {
      const e = computeEarnings(monthlyTraffic, c.space_type);
      return { categoryId: c.id, name: c.category_name, available: true, ...e };
    });

    const tier = getTierFromTraffic(monthlyTraffic);
    const totalOwnerEarnsPerMonth = summary.reduce((s, c) => s + (c.ownerEarns || 0), 0);

    return res.json({
      available: true,
      monthlyTraffic,
      trafficTier: tier.tier,
      totalOwnerEarnsPerMonth,
      scriptInstalled: true,
      categories: summary
    });

  } catch (err) {
    console.error('getWebsiteEarningsSummary error:', err.message);
    res.status(500).json({ message: 'Failed to fetch earnings summary', error: err.message });
  }
};