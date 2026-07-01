// adCustomization.js
// Shared ad-look resolution used by every rendering surface (the injected
// script, the per-website site script, and the iframe embed) so the default
// look, curated templates, font stacks, and slot-merge rules live in one
// place instead of three copies that can drift.
//
// A category can hold more than one ad slot (the website owner's chosen
// "number of ad spaces"). Each slot is styled independently — picking a
// template/color for slot 0 must never bleed into slot 1's look. An
// untouched slot resolves to exactly SYSTEM_DEFAULT.

const SYSTEM_DEFAULT = {
  backgroundColor: '#ffffff',
  titleColor: 'rgba(0,0,0,0.88)',
  descriptionColor: 'rgba(0,0,0,0.6)',
  ctaBackground: '#000000',
  ctaColor: '#ffffff',
  borderColor: 'rgba(0,0,0,0.08)',
  borderWidth: 1,
  shadow: 'medium',
  fontFamily: 'system',
  // Image area is capped by default — an advertiser's uploaded image (any
  // resolution/aspect ratio) must never be able to blow the card out of
  // proportion. imageHeight applies when imagePosition is 'top' (the image
  // sits above the text); imageWidthPercent when it's 'left' (image beside
  // the text). object-fit:cover crops to whichever box this defines.
  imageHeight: 160,
  imageWidthPercent: 40,
  // Width of the image box when imagePosition is 'top', as a percent of the
  // card's own width (the image is centered within that width). Defaults to
  // 100 so every ad configured before this setting existed keeps rendering
  // exactly as it did (full-bleed) — only imageHeight changes are visible.
  topImageWidthPercent: 100,
};

// Curated background+text bundles. backgroundColor can be any valid CSS
// `background` shorthand value (solid / gradient / layered pattern) — the
// renderer always writes it through the `background:` property, never
// `background-color:`, so gradients work without any extra plumbing.
const TEMPLATES = {
  clean: {
    label: 'Clean White',
    backgroundColor: '#ffffff',
    titleColor: 'rgba(0,0,0,0.88)',
    descriptionColor: 'rgba(0,0,0,0.6)',
    ctaBackground: '#000000',
    ctaColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.08)',
    shadow: 'medium',
  },
  sunset: {
    label: 'Sunset',
    backgroundColor: 'linear-gradient(135deg,#ff7e5f,#feb47b)',
    titleColor: '#ffffff',
    descriptionColor: 'rgba(255,255,255,0.92)',
    ctaBackground: '#ffffff',
    ctaColor: '#d9480f',
    borderColor: 'rgba(255,255,255,0.3)',
    shadow: 'large',
  },
  ocean: {
    label: 'Ocean Breeze',
    backgroundColor: 'linear-gradient(135deg,#2193b0,#6dd5ed)',
    titleColor: '#ffffff',
    descriptionColor: 'rgba(255,255,255,0.92)',
    ctaBackground: '#ffffff',
    ctaColor: '#0b6e8f',
    borderColor: 'rgba(255,255,255,0.3)',
    shadow: 'large',
  },
  forest: {
    label: 'Forest',
    backgroundColor: 'linear-gradient(135deg,#134e5e,#71b280)',
    titleColor: '#ffffff',
    descriptionColor: 'rgba(255,255,255,0.9)',
    ctaBackground: '#ffffff',
    ctaColor: '#134e5e',
    borderColor: 'rgba(255,255,255,0.25)',
    shadow: 'large',
  },
  royal: {
    label: 'Royal',
    backgroundColor: 'linear-gradient(135deg,#41295a,#2F0743)',
    titleColor: '#f5d98d',
    descriptionColor: 'rgba(255,255,255,0.85)',
    ctaBackground: '#f5d98d',
    ctaColor: '#2F0743',
    borderColor: 'rgba(245,217,141,0.4)',
    shadow: 'large',
  },
  futuristic: {
    label: 'Futuristic',
    backgroundColor: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
    titleColor: '#00f5ff',
    descriptionColor: 'rgba(255,255,255,0.85)',
    ctaBackground: 'linear-gradient(135deg,#00f5ff,#7b2ff7)',
    ctaColor: '#0f0c29',
    borderColor: 'rgba(0,245,255,0.4)',
    shadow: 'large',
  },
  africanPattern: {
    label: 'African Pattern',
    backgroundColor:
      'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 6px, transparent 7px),' +
      'radial-gradient(circle at 70% 65%, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 5px, transparent 6px),' +
      'radial-gradient(circle at 45% 85%, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 4px, transparent 5px),' +
      'linear-gradient(135deg,#d7263d,#f46036,#f7c548,#2e933c)',
    titleColor: '#ffffff',
    descriptionColor: 'rgba(255,255,255,0.92)',
    ctaBackground: '#1c1c1c',
    ctaColor: '#f7c548',
    borderColor: 'rgba(255,255,255,0.35)',
    shadow: 'large',
  },
  midnight: {
    label: 'Minimal Dark',
    backgroundColor: '#1a1a1f',
    titleColor: '#ffffff',
    descriptionColor: 'rgba(255,255,255,0.65)',
    ctaBackground: '#ffffff',
    ctaColor: '#1a1a1f',
    borderColor: 'rgba(255,255,255,0.12)',
    shadow: 'large',
  },
};

// Non-system fonts ship a Google Fonts `@import` that the injected <style>
// pulls in — fine for a dynamically created stylesheet on a third-party
// page, the same technique most embeddable widgets use.
const FONTS = {
  system:   { label: 'System Default', stack: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' },
  modern:   { label: 'Modern Sans',     stack: '"Poppins",-apple-system,sans-serif',       import: 'family=Poppins:wght@400;500;600;700' },
  elegant:  { label: 'Elegant Serif',   stack: '"Playfair Display",Georgia,serif',         import: 'family=Playfair+Display:wght@500;600;700' },
  friendly: { label: 'Friendly Round',  stack: '"Quicksand",-apple-system,sans-serif',     import: 'family=Quicksand:wght@500;600;700' },
  bold:     { label: 'Bold Display',    stack: '"Montserrat",-apple-system,sans-serif',    import: 'family=Montserrat:wght@600;700;800' },
  classic:  { label: 'Classic Slab',    stack: '"Roboto Slab",Georgia,serif',              import: 'family=Roboto+Slab:wght@500;600;700' },
};

const SHADOWS = {
  none: 'none',
  small: '0 2px 4px rgba(0,0,0,0.1)',
  medium: '0 8px 32px rgba(31,38,135,0.18)',
  large: '0 20px 50px rgba(0,0,0,0.3)',
};

const MIN_WIDTH = 160, MAX_WIDTH = 1200;
const MIN_HEIGHT = 90, MAX_HEIGHT = 800;
const MIN_IMAGE_HEIGHT = 60, MAX_IMAGE_HEIGHT = 360;
const MIN_IMAGE_WIDTH_PCT = 20, MAX_IMAGE_WIDTH_PCT = 65;
const MIN_TOP_IMAGE_WIDTH_PCT = 40, MAX_TOP_IMAGE_WIDTH_PCT = 100;
const MAX_SLOTS = 20; // sanity ceiling, independent of whatever user_count claims

// Roughly how much vertical room the title/description/CTA/padding need —
// used to keep the card height in step with the image height instead of
// leaving a tiny image floating in a huge box or a big image crammed into one.
const TEXT_AREA_RESERVE = 140;

function clampNumber(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, v));
}

// system default <- template (if any) <- explicit per-field overrides.
// Anything the slot doesn't set falls through to the previous layer, so an
// empty slot resolves to exactly SYSTEM_DEFAULT.
function resolveSlot(slotData) {
  const data = slotData || {};
  const template = data.template && TEMPLATES[data.template] ? TEMPLATES[data.template] : null;
  const resolved = { ...SYSTEM_DEFAULT, ...(template || {}), ...data };

  const w = clampNumber(resolved.width, MIN_WIDTH, MAX_WIDTH);
  if (w !== undefined) resolved.width = w; else delete resolved.width;
  const h = clampNumber(resolved.height, MIN_HEIGHT, MAX_HEIGHT);
  if (h !== undefined) resolved.height = h; else delete resolved.height;

  // Always defined (they're in SYSTEM_DEFAULT) — clamp in place rather than
  // drop, so a bad value falls back to a safe number instead of disappearing
  // from the CSS interpolation.
  resolved.imageHeight = clampNumber(resolved.imageHeight, MIN_IMAGE_HEIGHT, MAX_IMAGE_HEIGHT) ?? SYSTEM_DEFAULT.imageHeight;
  resolved.imageWidthPercent = clampNumber(resolved.imageWidthPercent, MIN_IMAGE_WIDTH_PCT, MAX_IMAGE_WIDTH_PCT) ?? SYSTEM_DEFAULT.imageWidthPercent;
  resolved.topImageWidthPercent = clampNumber(resolved.topImageWidthPercent, MIN_TOP_IMAGE_WIDTH_PCT, MAX_TOP_IMAGE_WIDTH_PCT) ?? SYSTEM_DEFAULT.topImageWidthPercent;

  resolved.shadowCss = SHADOWS[resolved.shadow] || SHADOWS.medium;
  const font = FONTS[resolved.fontFamily] || FONTS.system;
  resolved.fontStack = font.stack;
  resolved.fontImport = font.import || null;
  delete resolved.label;
  return resolved;
}

// Resolve every slot for a category (0..slotCount-1) from its raw JSONB
// customization blob. Returns the resolved bundles plus the deduped list of
// Google Fonts `@import` params actually in use, so the caller only pulls in
// what's needed.
function resolveAllSlots(customization, slotCount) {
  const count = Math.max(1, Math.min(MAX_SLOTS, slotCount || 1));
  const rawSlots = (customization && customization.slots) || {};
  const slots = [];
  const fontImports = new Set();
  for (let i = 0; i < count; i++) {
    const resolved = resolveSlot(rawSlots[String(i)]);
    if (resolved.fontImport) fontImports.add(resolved.fontImport);
    slots.push(resolved);
  }
  return { slots, fontImports: Array.from(fontImports) };
}

function truncateWords(text, maxWords) {
  const str = String(text == null ? '' : text).trim();
  if (!str) return '';
  const words = str.split(/\s+/);
  if (words.length <= maxWords) return str;
  return words.slice(0, maxWords).join(' ') + '…';
}

module.exports = {
  SYSTEM_DEFAULT, TEMPLATES, FONTS, SHADOWS,
  MIN_WIDTH, MAX_WIDTH, MIN_HEIGHT, MAX_HEIGHT, MAX_SLOTS,
  MIN_IMAGE_HEIGHT, MAX_IMAGE_HEIGHT, MIN_IMAGE_WIDTH_PCT, MAX_IMAGE_WIDTH_PCT,
  MIN_TOP_IMAGE_WIDTH_PCT, MAX_TOP_IMAGE_WIDTH_PCT, TEXT_AREA_RESERVE,
  clampNumber, resolveSlot, resolveAllSlots, truncateWords,
};
