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
  // Plain footer slot, one notch below Pro Footer — same banner shape.
  'Footer':               { width: 728, height: 90 },
  'Sidebar':              { width: 300, height: 250 },
  'Sticky Sidebar':       { width: 300, height: 250 },
  'Inline Content':       { width: 300, height: 250 },
  // Vertical rectangle, close to square, sized up from the old 300x250 —
  // deliberately bigger and taller-than-wide instead of a wide banner shape.
  'Floating':             { width: 340, height: 360 },
  // Widened from the original 160x600 "wide skyscraper" — 160 was too
  // narrow for a creative image to read well; 300x600 ("half page") gives
  // images real width while keeping the tall rail shape.
  'Left Rail':            { width: 300, height: 600 },
  // Mirrors Left Rail exactly — same shape, opposite side of the page.
  'Right Rail':           { width: 300, height: 600 },
  // Big enough to feel like the featured moment on the page without going
  // fullscreen (see placementCSS's viewport-relative cap below) — same 3:2
  // shape as before, just scaled up.
  'Modal':                { width: 900, height: 600 },
  'Pre-roll':             { width: 1280, height: 720 },
  'Mid-roll':             { width: 1280, height: 720 },
  'Pause':                { width: 1280, height: 720 },
};

function getDimensions(spaceType) {
  return AD_SPACE_DIMENSIONS[canonicalSpace(spaceType)] || null;
}

const BANNER = AD_SPACE_DIMENSIONS['Header'];       // 728x90
const RECT   = AD_SPACE_DIMENSIONS['Sidebar'];       // 300x250
const RAIL   = AD_SPACE_DIMENSIONS['Left Rail'];     // 300x600
const MODAL  = AD_SPACE_DIMENSIONS['Modal'];         // 900x600
const FLOAT  = AD_SPACE_DIMENSIONS['Floating'];      // 340x400

// CSS per canonical spaceType, keyed with a {{PX}} placeholder instead of an
// interpolated prefix — used by both scripts (see comment above).
// Every in-flow placement below (everything except Floating/Modal, which are
// deliberate viewport-pinned overlays) forces its box dimensions and margin
// with !important. A host div sitting inside someone else's page layout can
// otherwise have its computed height/margin silently overridden by whatever
// CSS that page already has (a reset, a flex/grid parent, load order — no
// way to know in advance), which is exactly how a site's own header/nav can
// end up sitting flush against (or visually "over") an ad box that never
// actually got its real height and spacing. !important makes this box's
// footprint in the document non-negotiable: the page can style its own
// content into whatever's left, but it cannot shrink or crowd this box, and
// this box in turn is guaranteed to never overlap anything before or after
// it in the flow. Floating/Modal don't need this — position:fixed already
// takes them out of document flow entirely, so nothing else on the page can
// push into or overlap them either way.
const PLACEMENT_CSS_TEMPLATES = {
  // Deliberately NOT !important: this is a default meant to be overridden by
  // the specific template appended after it (that's what position:relative
  // here becoming position:fixed for Floating/Modal below relies on — since
  // !important always wins over a non-!important rule regardless of source
  // order, making this base rule !important would make it override even our
  // OWN later, more specific rule for the same property, which is exactly
  // the bug that briefly knocked Floating out of its pinned corner and into
  // normal page flow. Only the specific per-type rules below need
  // !important, to resist the page's OWN external CSS.
  base: `.{{PX}}-host{display:block;width:100%;box-sizing:border-box;position:relative;overflow:visible;}`,

  'header':          `.{{PX}}-host{width:100%!important;max-width:${BANNER.width}px!important;height:${BANNER.height}px!important;margin:0 auto 24px!important;overflow:hidden!important;float:none!important;}`,
  'above the fold':  `.{{PX}}-host{width:100%!important;max-width:${BANNER.width}px!important;height:${BANNER.height}px!important;margin:0 auto 24px!important;overflow:hidden!important;float:none!important;}`,
  'beneath title':   `.{{PX}}-host{width:100%!important;max-width:${BANNER.width}px!important;height:${BANNER.height}px!important;margin:12px auto 24px!important;overflow:hidden!important;float:none!important;}`,
  'pro footer':      `.{{PX}}-host{width:100%!important;max-width:${BANNER.width}px!important;height:${BANNER.height}px!important;margin:24px auto 0!important;overflow:hidden!important;float:none!important;}`,
  'footer':          `.{{PX}}-host{width:100%!important;max-width:${BANNER.width}px!important;height:${BANNER.height}px!important;margin:24px auto 0!important;overflow:hidden!important;float:none!important;}`,

  'inline content':  `.{{PX}}-host{float:right!important;width:${RECT.width}px!important;height:${RECT.height}px!important;margin:0 0 12px 20px!important;overflow:hidden!important;}@media(max-width:600px){.{{PX}}-host{float:none!important;width:100%!important;height:auto!important;max-height:${RECT.height}px!important;margin:12px 0!important;}}`,
  'sidebar':         `.{{PX}}-host{width:${RECT.width}px!important;height:${RECT.height}px!important;margin:0 0 16px 0!important;max-width:100%!important;overflow:hidden!important;float:none!important;}`,
  'sticky sidebar':  `.{{PX}}-host{position:sticky!important;top:80px!important;width:${RECT.width}px!important;height:${RECT.height}px!important;max-width:100%!important;z-index:100!important;overflow:hidden!important;float:none!important;}`,
  // position:fixed pins this to the viewport (bottom-right corner) no matter
  // where in the page's markup the placeholder div actually sits — the div's
  // spot in the DOM never matters, only which page it's configured for.
  // max-height:80vh keeps it from overflowing short viewports at the taller
  // 340x400 size; z-index:99998 sits just under Modal's 99999 so a Modal
  // opening on the same page still layers above a Floating ad.
  'floating':        `.{{PX}}-host{position:fixed;bottom:24px;right:24px;width:${FLOAT.width}px;height:${FLOAT.height}px;max-height:80vh;z-index:99998;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.18));}@media(max-width:480px){.{{PX}}-host{width:calc(100% - 32px);max-width:${FLOAT.width}px;left:16px;right:16px;bottom:16px;height:min(${FLOAT.height}px, 60vh);}}`,

  'left rail':       `.{{PX}}-host{width:${RAIL.width}px!important;min-height:${RAIL.height}px!important;position:sticky!important;top:80px!important;margin-right:16px!important;float:none!important;}@media(max-width:768px){.{{PX}}-host{width:100%!important;min-height:0!important;position:static!important;}}`,
  // Mirrors Left Rail's shape/behavior, but a block-level box sits at the
  // LEFT edge of its container by default no matter what margin-* it has —
  // margin only adds space around a box, it doesn't relocate it. Left Rail
  // "looks right" by accident (default-left already matches where it's
  // supposed to be); Right Rail needs margin-left:auto to actually push it
  // to the right edge, with margin-right for a small gap off the page edge.
  'right rail':      `.{{PX}}-host{width:${RAIL.width}px!important;min-height:${RAIL.height}px!important;position:sticky!important;top:80px!important;margin:0 16px 0 auto!important;float:none!important;}@media(max-width:768px){.{{PX}}-host{width:100%!important;min-height:0!important;position:static!important;margin:0!important;}}`,

  // position:fixed;inset:0 also pins Modal to the viewport regardless of the
  // div's DOM placement, same as Floating above. The ad itself is capped
  // with min(): whichever is smaller of "most of the viewport" (92vw/88vh)
  // or the canonical 900x600 — big enough to read as the featured thing on
  // the page without ever going edge-to-edge/fullscreen, so it still reads
  // as an ad and not the page itself, and never overflows on small screens.
  'modal':           `.{{PX}}-host{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);}.{{PX}}-host>*{max-width:min(92vw,${MODAL.width}px);max-height:min(88vh,${MODAL.height}px);}`,

  'pre-roll':        `.{{PX}}-host{width:100%!important;max-width:640px!important;aspect-ratio:16/9!important;margin:16px auto!important;float:none!important;}`,
  'mid-roll':         `.{{PX}}-host{width:100%!important;max-width:640px!important;aspect-ratio:16/9!important;margin:16px auto!important;float:none!important;}`,
  'pause':           `.{{PX}}-host{width:100%!important;max-width:640px!important;aspect-ratio:16/9!important;margin:16px auto!important;float:none!important;}`,
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
