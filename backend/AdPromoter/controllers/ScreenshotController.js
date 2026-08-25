// ScreenshotController.js
// Renders the "Check live placement" view server-side instead of sending the
// owner to a second tab. A real <iframe> of the owner's live site was ruled
// out on purpose (see buildLiveCheckUrl in codeDisplay.tsx) — most real sites
// send X-Frame-Options/CSP headers that refuse to be framed by another
// origin, which is the site protecting itself, not something Yepper can work
// around. A screenshot sidesteps that entirely: Puppeteer loads the real page
// in a headless browser on the server, lets the site-wide script draw its
// usual "Check live placement" highlight boxes (see showZoneHighlight in
// SiteScriptController.js), and ships back a PNG of the result.
const puppeteer = require('puppeteer');
const AdCategory = require('../models/CreateCategoryModel');
const Website = require('../models/CreateWebsiteModel');

// One headless browser reused across requests — launching Chromium (a few
// hundred ms to seconds) on every single screenshot would make this endpoint
// needlessly slow. Re-launched lazily if it ever crashes/disconnects.
let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing && existing.isConnected()) return existing;
    browserPromise = null;
  }
  browserPromise = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browserPromise;
}

// Same URL the "Check live placement" new-tab link uses (buildLiveCheckUrl in
// codeDisplay.tsx) — built server-side here instead of trusting a
// client-supplied URL, since this endpoint fetches whatever URL it's given
// and an attacker-controlled URL would turn it into an open SSRF proxy.
function buildLiveUrl(website, category) {
  const rawDomain = website?.website_link;
  if (!rawDomain) return null;
  const path = category.target_path
    || (Array.isArray(category.detected_pages) && category.detected_pages[0])
    || null;
  if (!path) return null;
  const domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`;
  const base = domain.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const sep = normalizedPath.includes('?') ? '&' : '?';
  return `${base}${normalizedPath}${sep}yepperHighlight=${category.id}`;
}

exports.capturePlacement = async (req, res) => {
  const { categoryId } = req.params;
  let page = null;
  try {
    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const ownerId = category.owner_id?.toString();
    const userId = (req.user.id || req.user._id || req.user.userId)?.toString();
    if (ownerId !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const website = await Website.findById(category.website_id);
    if (!website) return res.status(404).json({ success: false, message: 'Website not found' });

    const liveUrl = buildLiveUrl(website, category);
    if (!liveUrl) {
      return res.status(400).json({
        success: false,
        message: 'No confirmed page yet — visit the site once with the ad live so Yepper can detect which page it\'s on.',
      });
    }

    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(liveUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // The site-wide script draws its highlight boxes 350ms after the ad in
    // this exact space renders (see renderAds in SiteScriptController.js) —
    // wait for that orange box specifically instead of a blind timeout, but
    // don't fail the whole request if it never shows (e.g. the div genuinely
    // isn't on this page): a screenshot without the highlight is still more
    // useful than an error.
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('div')).some(
        (d) => (d.style.border || '').indexOf('ff6600') !== -1,
      ),
      { timeout: 8000 },
    ).catch(() => {});

    // Center the highlighted box in the shot so it's visible regardless of
    // whether the space is up in the header or down in the footer.
    await page.evaluate(() => {
      const box = Array.from(document.querySelectorAll('div')).find(
        (d) => (d.style.border || '').indexOf('ff6600') !== -1,
      );
      if (box) {
        const rect = box.getBoundingClientRect();
        window.scrollTo(0, rect.top + window.scrollY - window.innerHeight / 2);
      }
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));

    const buffer = await page.screenshot({ type: 'png' });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    console.error('Error capturing live placement screenshot:', error);
    res.status(502).json({ success: false, message: 'Could not load the live page — it may be down or blocking automated visits.' });
  } finally {
    if (page) await page.close().catch(() => {});
  }
};
