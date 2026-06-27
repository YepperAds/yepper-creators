'use strict';

// Creators edit the advertiser's creative into their video themselves before
// uploading — Render never touches video bytes for ad placement at all. What's
// left here is just the ad-format catalog (corner badge vs L-bar, sizes)
// shared by the advertiser-facing claim flow, plus a small memory logger
// reused by the YouTube-upload relay job.

// Visual ad formats an advertiser picks when claiming a slot. Sizes are
// expressed as ratios of the video's own width/height so they scale to any
// resolution. Exported so the frontend can render the same labels/descriptions
// without duplicating them.
const AD_FORMATS = {
  corner: {
    label: 'Corner Badge',
    description: 'A small badge that pops up in a corner of the video and fades in/out without covering the content.',
    sizes: {
      small:  { ratio: 0.15 },
      medium: { ratio: 0.22 },
      large:  { ratio: 0.30 },
    },
  },
  lbar: {
    label: 'L-Bar',
    description: 'An L-shaped banner — a strip down the left edge plus a strip along the bottom — more visible than a corner badge, like on-screen TV branding.',
    sizes: {
      small:  { vRatio: 0.06, hRatio: 0.10 },
      medium: { vRatio: 0.08, hRatio: 0.14 },
      large:  { vRatio: 0.11, hRatio: 0.18 },
    },
  },
};
const AD_TYPES = Object.keys(AD_FORMATS);
const AD_SIZES = ['small', 'medium', 'large'];

function memLog(label) {
  const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[memlog] ${label}: RSS=${mb}MB`);
}

module.exports = { AD_FORMATS, AD_TYPES, AD_SIZES, memLog };
