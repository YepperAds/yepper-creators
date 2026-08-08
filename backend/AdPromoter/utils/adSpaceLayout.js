// adSpaceLayout.js — single source of truth for ad-space container sizing.
//
// Previously this table was hand-duplicated between SiteScriptController.js
// (the new site-wide script) and AdScriptController.js (the legacy
// per-category script), and neither set an explicit height — only
// max-width — so a slot's real on-page size was whatever the advertiser's
// uploaded image happened to be. Both scripts now require this file instead
// of keeping their own copy, and isImageSizeAcceptable() (used at upload
// time in WebAdvertiseController.js, mirrored client-side in
// direct-ad/page.tsx) stops a wrongly-shaped image from being accepted in
// the first place.
const { canonicalSpace, SPACE_ALIASES } = require('../../models/PricingModel');

// Canonical IAB-style dimensions per space type (keyed by Pricing.SPACE_TYPES
// names — canonicalSpace() normalizes whatever casing/alias is stored on the
// ad_categories row before this table is consulted).
const AD_SPACE_DIMENSIONS = {
  'Header':               { width: 728, height: 90 },
  'Above The Fold':       { width: 728, height: 90 },
  'Beneath Title':        { width: 728, height: 90 },
  'Pro Footer':           { width: 728, height: 90 },
  'Sidebar':              { width: 300, height: 250 },
  'Sticky Sidebar':       { width: 300, height: 250 },
  'Inline Content':       { width: 300, height: 250 },
  'Floating':             { width: 300, height: 250 },
  'Left Rail':            { width: 160, height: 600 },
  'Modal':                { width: 600, height: 400 },
  'Pre-roll':             { width: 1280, height: 720 },
  'Mid-roll':             { width: 1280, height: 720 },
  'Pause':                { width: 1280, height: 720 },
};

function getDimensions(spaceType) {
  return AD_SPACE_DIMENSIONS[canonicalSpace(spaceType)] || null;
}

const BANNER = AD_SPACE_DIMENSIONS['Header'];       // 728x90
const RECT   = AD_SPACE_DIMENSIONS['Sidebar'];       // 300x250
const RAIL   = AD_SPACE_DIMENSIONS['Left Rail'];     // 160x600
const MODAL  = AD_SPACE_DIMENSIONS['Modal'];         // 600x400

// CSS per canonical spaceType, keyed with a {{PX}} placeholder instead of an
// interpolated prefix — used by both scripts (see comment above).
const PLACEMENT_CSS_TEMPLATES = {
  base: `.{{PX}}-host{display:block;width:100%;box-sizing:border-box;position:relative;overflow:visible;}`,

  'header':          `.{{PX}}-host{width:100%;max-width:${BANNER.width}px;height:${BANNER.height}px;margin:0 auto;overflow:hidden;}`,
  'above the fold':  `.{{PX}}-host{width:100%;max-width:${BANNER.width}px;height:${BANNER.height}px;margin:0 auto 16px;overflow:hidden;}`,
  'beneath title':   `.{{PX}}-host{width:100%;max-width:${BANNER.width}px;height:${BANNER.height}px;margin:12px auto 20px;overflow:hidden;}`,
  'pro footer':      `.{{PX}}-host{width:100%;max-width:${BANNER.width}px;height:${BANNER.height}px;margin:24px auto 0;overflow:hidden;}`,

  'inline content':  `.{{PX}}-host{float:right;width:${RECT.width}px;height:${RECT.height}px;margin:0 0 12px 20px;overflow:hidden;}@media(max-width:600px){.{{PX}}-host{float:none;width:100%;height:auto;max-height:${RECT.height}px;margin:12px 0;}}`,
  'sidebar':         `.{{PX}}-host{width:${RECT.width}px;height:${RECT.height}px;margin:0 0 16px 0;max-width:100%;overflow:hidden;}`,
  'sticky sidebar':  `.{{PX}}-host{position:sticky;top:80px;width:${RECT.width}px;height:${RECT.height}px;max-width:100%;z-index:100;overflow:hidden;}`,
  'floating':        `.{{PX}}-host{position:fixed;bottom:24px;right:24px;width:${RECT.width}px;height:${RECT.height}px;z-index:9999;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.18));}@media(max-width:480px){.{{PX}}-host{width:calc(100% - 32px);left:16px;right:16px;bottom:16px;}}`,

  'left rail':       `.{{PX}}-host{width:${RAIL.width}px;min-height:${RAIL.height}px;position:sticky;top:80px;margin-right:16px;}@media(max-width:768px){.{{PX}}-host{width:100%;min-height:0;position:static;}}`,

  'modal':           `.{{PX}}-host{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);}.{{PX}}-host>*{max-width:${MODAL.width}px;max-height:${MODAL.height}px;}`,

  'pre-roll':        `.{{PX}}-host{width:100%;max-width:640px;aspect-ratio:16/9;margin:16px auto;}`,
  'mid-roll':         `.{{PX}}-host{width:100%;max-width:640px;aspect-ratio:16/9;margin:16px auto;}`,
  'pause':           `.{{PX}}-host{width:100%;max-width:640px;aspect-ratio:16/9;margin:16px auto;}`,
};

// canonicalSpace() returns the display-cased canonical name ("Left Rail") —
// the template table above is keyed lowercase, so normalize once more here.
function placementCSS(spaceType, px) {
  const key = canonicalSpace(spaceType).toLowerCase();
  const fill = (tpl) => (tpl || '').split('{{PX}}').join(px);
  return fill(PLACEMENT_CSS_TEMPLATES.base) + fill(PLACEMENT_CSS_TEMPLATES[key]);
}

// The client-side fallback in the injected site script (loadSpaceById, for a
// category discovered via a data-yepper-space div that wasn't in the
// pre-baked list) can't call canonicalSpace() itself — it's plain JS shipped
// to the browser, not a Node module. So it just lowercases the raw
// space_type it gets from the API and does a direct key lookup. To keep that
// working without re-implementing alias resolution in the browser, this
// expands PLACEMENT_CSS_TEMPLATES to also have an entry for every raw
// spelling SPACE_ALIASES knows about (e.g. 'modalpic' as well as 'modal'),
// each pointing at the same canonical template — then gets embedded
// verbatim as the client script's own template object.
function buildExpandedTemplatesForClient() {
  const expanded = { base: PLACEMENT_CSS_TEMPLATES.base };
  for (const [alias, canonical] of Object.entries(SPACE_ALIASES)) {
    expanded[alias] = PLACEMENT_CSS_TEMPLATES[canonical.toLowerCase()];
  }
  return expanded;
}

// Accepts an uploaded image if its aspect ratio is within 15% of the space
// type's canonical aspect ratio and its resolution is at least half the
// canonical width/height — close enough to look right once the slot scales
// it via CSS, without demanding a pixel-perfect match.
const ASPECT_TOLERANCE = 0.15;
const MIN_SCALE = 0.5;

function isImageSizeAcceptable(spaceType, imgWidth, imgHeight) {
  const expected = getDimensions(spaceType);
  if (!expected || !imgWidth || !imgHeight) return { ok: true, expected: expected || null };

  const targetRatio = expected.width / expected.height;
  const actualRatio = imgWidth / imgHeight;
  const ratioDelta = Math.abs(actualRatio - targetRatio) / targetRatio;

  const tooSmall = imgWidth < expected.width * MIN_SCALE || imgHeight < expected.height * MIN_SCALE;
  const wrongShape = ratioDelta > ASPECT_TOLERANCE;

  if (!tooSmall && !wrongShape) return { ok: true, expected };

  const message = wrongShape
    ? `This image is ${imgWidth}×${imgHeight}, but this ad space needs something close to ${expected.width}×${expected.height} (a ${(targetRatio).toFixed(2)}:1 shape). Please upload a differently-sized image.`
    : `This image is only ${imgWidth}×${imgHeight}, which is too small for this ad space. Please upload something closer to ${expected.width}×${expected.height} or larger.`;

  return { ok: false, expected, message };
}

module.exports = { AD_SPACE_DIMENSIONS, getDimensions, placementCSS, isImageSizeAcceptable, buildExpandedTemplatesForClient };
