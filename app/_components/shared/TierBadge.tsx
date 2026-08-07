import { CheckBadgeIcon } from '@heroicons/react/24/solid';

// Rank badge for a website's traffic tier — grey for Unverified up through
// gold for Elite, same six tiers earningsController/PricingTiers already
// compute from real script-tracked traffic (see
// backend/AdPromoter/controllers/earningsController.js's getTierFromTraffic).
// Purely presentational: takes whatever `trafficTier` string the site
// already carries, no separate fetch.
//
// CheckBadgeIcon (the scalloped-seal + checkmark shape) is the same badge
// silhouette X/Instagram use for verification — just the icon, colored per
// tier, no background pill/label, same as those. Premium is X's own
// verified blue specifically, not a spot on the metal/gem ramp.
const TIER_COLORS: Record<string, string> = {
  unverified: '#9CA3AF', // grey
  starter:    '#C87F45', // bronze
  basic:      '#B0B7C3', // silver
  standard:   '#10B981', // emerald
  premium:    '#1D9BF0', // blue (X/Instagram verified blue)
  elite:      '#F5B700', // gold
};

// "Unverified" reads as "New" in the tooltip specifically for this
// public-facing badge: an advertiser comparing sites shouldn't read a
// brand-new site as flagged/suspicious, just early — same reasoning as the
// cold-start ranking approach (show honestly, don't penalize for being
// new). Internal/admin surfaces that already say "Unverified" elsewhere are
// untouched by this.
const TIER_LABELS: Record<string, string> = {
  unverified: 'New',
  starter:    'Starter',
  basic:      'Basic',
  standard:   'Standard',
  premium:    'Premium',
  elite:      'Elite',
};

export default function TierBadge({ tier, className = '' }: { tier?: string | null; className?: string }) {
  const key   = tier && TIER_COLORS[tier] ? tier : 'unverified';
  const color = TIER_COLORS[key];
  const label = TIER_LABELS[key];
  return (
    <CheckBadgeIcon
      className={`w-4 h-4 shrink-0 ${className}`}
      style={{ color }}
      title={`${label} tier`}
    />
  );
}
