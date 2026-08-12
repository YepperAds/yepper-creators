'use client';
// @ts-nocheck

// PricingTiers.js
// Determines the web owner's tier purely from real script-tracked monthly
// traffic (same number the tracking script reports — see
// analyticsController.trackPageView), same way a new YouTube channel starts
// at 0 subscribers and grows from real activity rather than some separate
// verification step. Emits price data upward AND renders a visible tier
// badge + price cap in the add-space modal.

import { useEffect } from 'react';

// ── Tier definitions (matches pricing xlsx) ──────────────────────────────────
const TRAFFIC_TIERS = [
  {
    tier: 'unverified',
    label: 'Unverified',
    description: 'Under 500 monthly visitors: 63,000 RWF total cap split across all spaces',
    min: 0,
    max: 0,
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fcd34d',
    textColor: '#92400e',
  },
  {
    tier: 'starter',
    label: 'Starter',
    description: '500 – 2,000 monthly visitors',
    min: 500,
    max: 2000,
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#93c5fd',
    textColor: '#1e40af',
  },
  {
    tier: 'basic',
    label: 'Basic',
    description: '2,001 – 10,000 monthly visitors',
    min: 2001,
    max: 10000,
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    textColor: '#065f46',
  },
  {
    tier: 'standard',
    label: 'Standard',
    description: '10,001 – 50,000 monthly visitors',
    min: 10001,
    max: 50000,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    textColor: '#4c1d95',
  },
  {
    tier: 'premium',
    label: 'Premium',
    description: '50,001 – 200,000 monthly visitors',
    min: 50001,
    max: 200000,
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fdba74',
    textColor: '#7c2d12',
  },
  {
    tier: 'elite',
    label: 'Elite',
    description: '200,001+ monthly visitors',
    min: 200001,
    max: Infinity,
    color: '#000000',
    bg: '#f9fafb',
    border: '#111827',
    textColor: '#000000',
  },
];

// ── Exact prices per space per tier (from Yepper pricing xlsx) ───────────────
const TIER_PRICES = {
  unverified: {
    // 63,000 total cap: individual space prices allocated by visibility
    totalCap: 63000,
    'Header': 9000,
    'Above The Fold': 7800,
    'Sticky Sidebar': 6000,
    'Floating': 4800,
    'Modal': 4200,
    'Left Rail': 3600,
    'Sidebar': 3000,
    'Inline Content': 2400,
    'Beneath Title': 2100,
    'Pro Footer': 1500,
    'Pre-roll': 11200,
    'Mid-roll': 13500,
    'Pause': 5000,
  },
  starter: {
    'Header': 3000,
    'Above The Fold': 2600,
    'Sticky Sidebar': 2000,
    'Floating': 1600,
    'Modal': 1400,
    'Left Rail': 1200,
    'Sidebar': 1000,
    'Inline Content': 800,
    'Beneath Title': 700,
    'Pro Footer': 500,
    'Pre-roll': 3800,
    'Mid-roll': 4500,
    'Pause': 1700,
  },
  basic: {
    'Header': 15000,
    'Above The Fold': 13000,
    'Sticky Sidebar': 10000,
    'Floating': 8000,
    'Modal': 7000,
    'Left Rail': 6000,
    'Sidebar': 5000,
    'Inline Content': 4000,
    'Beneath Title': 3500,
    'Pro Footer': 2500,
    'Pre-roll': 18800,
    'Mid-roll': 22500,
    'Pause': 8200,
  },
  standard: {
    'Header': 30000,
    'Above The Fold': 26000,
    'Sticky Sidebar': 20000,
    'Floating': 16000,
    'Modal': 14000,
    'Left Rail': 12000,
    'Sidebar': 10000,
    'Inline Content': 8000,
    'Beneath Title': 7000,
    'Pro Footer': 5000,
    'Pre-roll': 38000,
    'Mid-roll': 45000,
    'Pause': 17000,
  },
  premium: {
    'Header': 82000,
    'Above The Fold': 71000,
    'Sticky Sidebar': 55000,
    'Floating': 44000,
    'Modal': 38000,
    'Left Rail': 33000,
    'Sidebar': 27000,
    'Inline Content': 22000,
    'Beneath Title': 19000,
    'Pro Footer': 14000,
    'Pre-roll': 102000,
    'Mid-roll': 123000,
    'Pause': 45000,
  },
  elite: {
    'Header': 220000,
    'Above The Fold': 190000,
    'Sticky Sidebar': 148000,
    'Floating': 118000,
    'Modal': 102000,
    'Left Rail': 88000,
    'Sidebar': 73000,
    'Inline Content': 59000,
    'Beneath Title': 51000,
    'Pro Footer': 37000,
    'Pre-roll': 275000,
    'Mid-roll': 330000,
    'Pause': 121000,
  },
};

// Map spaceType strings (from categoryDetails) → canonical price table keys
const SPACE_TYPE_MAP = {
  'Header': 'Header',
  'Above The Fold': 'Above The Fold',
  'Sticky Sidebar': 'Sticky Sidebar',
  'stickySidebar': 'Sticky Sidebar',
  'Floating': 'Floating',
  'floating': 'Floating',
  'Modal': 'Modal',
  'modalPic': 'Modal',
  'Left Rail': 'Left Rail',
  'leftRail': 'Left Rail',
  'Sidebar': 'Sidebar',
  'sidebar': 'Sidebar',
  'Inline Content': 'Inline Content',
  'inlineContent': 'Inline Content',
  'Beneath Title': 'Beneath Title',
  'beneathTitle': 'Beneath Title',
  'Pro Footer': 'Pro Footer',
  'proFooter': 'Pro Footer',
  'Pre-roll': 'Pre-roll',
  'preroll': 'Pre-roll',
  'Preroll': 'Pre-roll',
  'Mid-roll': 'Mid-roll',
  'midroll': 'Mid-roll',
  'Midroll': 'Mid-roll',
  'Pause': 'Pause',
  'pause': 'Pause',
};

// ── Exported helpers ─────────────────────────────────────────────────────────

/** Get the price cap for a given space type at a given tier. */
export function getPriceForTier(tier, spaceType) {
  const key = SPACE_TYPE_MAP[spaceType] || spaceType;
  const prices = TIER_PRICES[tier] || TIER_PRICES.unverified;
  return prices[key] ?? null;
}

/** Human label for a tier key, e.g. 'premium' -> 'Premium'. Used by the
 * "Add the price you want" current-tier slot to show which tier it locked to. */
export function getTierLabel(tier) {
  return TRAFFIC_TIERS.find(t => t.tier === tier)?.label
    ?? (tier ? tier[0].toUpperCase() + tier.slice(1) : 'Starter');
}

// ── Component ────────────────────────────────────────────────────────────────
// Renders just the owner's earnings for this space type — no tier badge, no
// price cap, no Yepper cut, no traffic-threshold messaging (see render below).

const PricingTiers = ({  selectedPrice, onPriceSelect, monthlyTraffic, spaceType, grantedTier  }: any) => {

  // Every new ad space starts at Starter pricing regardless of claimed/real
  // traffic — the server enforces this too (createCategoryController ignores
  // whatever tier is submitted and always prices new spaces at Starter). It
  // auto-promotes to whatever tier the site's real traffic earns after a
  // 3-day grace period (see promoteGracePeriodAdSpaces.js), so this preview
  // shows Starter rather than a resolved-from-traffic tier that wouldn't
  // actually be what gets charged on day one.
  const tierKey    = 'starter';
  const priceKey   = SPACE_TYPE_MAP[spaceType] || spaceType;
  const spacePrice = TIER_PRICES[tierKey]?.[priceKey] ?? null;
  // Owner keeps the full listed price — Yepper's margin is added on top for
  // the advertiser at checkout, never subtracted from the owner's side.
  const ownerEarns = spacePrice;

  // Emit price data upward
  useEffect(() => {
    const tier = TRAFFIC_TIERS.find(t => t.tier === tierKey);
    onPriceSelect({
      price: spacePrice || 0,
      visitors: tier.min,
      tier: tierKey,
      visitorRange: { min: tier.min, max: tier.max === Infinity ? 9999999 : tier.max },
      ownerEarns: ownerEarns || 0,
      isUnverified: false,
    });
  }, [tierKey, spacePrice]); // eslint-disable-line

  // ── Render ──
  // Deliberately just "what you'll earn" — no tier name, no price cap, no
  // Yepper's cut, no traffic-threshold messaging. All of that is what the
  // advertiser gets charged and why; the owner configuring this space only
  // needs the one number that's actually theirs.
  return (
    <div style={{ border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', padding: '16px' }}>
      {spacePrice !== null ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#000', margin: '0 0 4px 0', opacity: 0.7, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Price
          </p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', margin: 0 }}>
            RWF {ownerEarns.toLocaleString()}
          </p>
          <p style={{ fontSize: '11px', color: '#000', margin: '4px 0 0 0', opacity: 0.6 }}>
            per advertiser/mo
          </p>
          <p style={{ fontSize: '11px', color: '#000', margin: '8px 0 0 0', opacity: 0.55 }}>
            Starts here for every new space. Moves up automatically once your real traffic earns a higher tier (about 3 days in).
          </p>
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: '#000', margin: 0 }}>
          Price not available for this space type.
        </p>
      )}
    </div>
  );
};

export default PricingTiers;