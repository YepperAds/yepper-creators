// logoDetect.js — server-side fallback for logo detection.
//
// The primary path (SiteScriptController's detectLogo/verifyImage, run in
// the visitor's own browser) needs a real pageview with the tracking script
// installed before it ever fires — fine for active sites, but a low-traffic
// or freshly-added site can sit with no logo for a long time waiting on
// that. This does the same "find candidates, verify each is a real image"
// work from the server instead, by fetching the site's homepage directly —
// so a website can get a logo the moment it's added, without waiting on a
// visitor.
const https = require('https');
const http = require('http');
const { URL } = require('url');

function fetchText(targetUrl, timeoutMs = 8000, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(targetUrl); } catch (e) { return reject(e); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YepperLogoBot/1.0)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        try {
          const next = new URL(res.headers.location, u).href;
          fetchText(next, timeoutMs, redirectsLeft - 1).then(resolve, reject);
        } catch (e) { reject(e); }
        return;
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(''); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
        if (data.length > 500000) req.destroy(); // homepage <head> is always well within this
      });
      res.on('end', () => resolve(data));
      res.on('error', () => resolve(''));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

// A 200 status only means the URL responds, not that it's an image — a
// site's SPA catch-all route happily 200s a path that was never really
// deployed with its index-page HTML instead. Only a real image/* content
// type counts as verified.
function verifyImageUrl(targetUrl, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(targetUrl); } catch (e) { return resolve(null); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YepperLogoBot/1.0)' } }, (res) => {
      const contentType = res.headers['content-type'] || '';
      res.destroy();
      resolve(res.statusCode === 200 && /^image\//i.test(contentType) ? targetUrl : null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Same preference order as the client-side detectLogo(): highest-fidelity
// declared icon first, og:image next, /favicon.ico as the last resort.
function extractCandidates(html, baseUrl) {
  const out = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  const relOrder = [/rel=["']apple-touch-icon["']/i, /rel=["']icon["']/i, /rel=["']shortcut icon["']/i];
  for (const relRe of relOrder) {
    const tag = linkTags.find((t) => relRe.test(t));
    if (!tag) continue;
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      try { out.push(new URL(hrefMatch[1], baseUrl).href); } catch (e) {}
    }
  }
  const ogTag = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i);
  if (ogTag) {
    const contentMatch = ogTag[0].match(/content=["']([^"']+)["']/i);
    if (contentMatch) {
      try { out.push(new URL(contentMatch[1], baseUrl).href); } catch (e) {}
    }
  }
  try { out.push(new URL('/favicon.ico', baseUrl).href); } catch (e) {}
  return out;
}

async function detectLogoServerSide(websiteLink) {
  if (!websiteLink) return null;
  const base = websiteLink.startsWith('http') ? websiteLink : `https://${websiteLink}`;
  const html = await fetchText(base);
  if (!html) return null;
  const candidates = extractCandidates(html, base);
  for (const candidate of candidates) {
    const verified = await verifyImageUrl(candidate);
    if (verified) return verified;
  }
  return null;
}

// Covers both cases a stored logo can be wrong in: never detected yet
// (currentImageUrl is empty), or detected once from a URL that looked valid
// at the time but doesn't actually serve an image (a site's SPA catch-all
// 200ing a path that was never really deployed, a favicon that moved since,
// etc.) — re-runs full detection only when the currently stored URL fails
// its own verification, so a working logo is never redundantly re-fetched.
async function ensureLogo(currentImageUrl, websiteLink) {
  if (currentImageUrl) {
    const stillGood = await verifyImageUrl(currentImageUrl);
    if (stillGood) return null; // nothing to change
  }
  return detectLogoServerSide(websiteLink);
}

module.exports = { detectLogoServerSide, verifyImageUrl, ensureLogo };
