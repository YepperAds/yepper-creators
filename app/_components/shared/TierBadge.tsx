// Rank badge for a website's traffic tier — grey for Unverified up through
// gold for Elite, same six tiers earningsController/PricingTiers already
// compute from real script-tracked traffic (see
// backend/AdPromoter/controllers/earningsController.js's getTierFromTraffic).
// Purely presentational: takes whatever `trafficTier` string the site
// already carries, no separate fetch.
//
// Solid opaque background rather than a transparent/outline style on
// purpose — this sits on top of photos, gradients, and both light (marketing
// WebsiteRow) and dark (dashboard HomeFeed/DashboardFeed) card backgrounds,
// so it needs to read clearly regardless of what's behind it, the same way
// the existing "View"/"Choose ad space" absolute-positioned overlay labels
// in these same files use an opaque bg instead of relying on context.
//
// "Unverified" is relabeled "New" here specifically for public-facing
// display: an advertiser comparing sites shouldn't read a brand-new site as
// flagged/suspicious, just early — same reasoning as the cold-start ranking
// approach (show honestly, don't penalize for being new). Internal/admin
// surfaces that already say "Unverified" elsewhere are untouched by this.
const TIER_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  unverified: { label: 'New',      bg: '#9CA3AF', text: '#1F2937' }, // grey
  starter:    { label: 'Starter',  bg: '#C87F45', text: '#FFFFFF' }, // bronze
  basic:      { label: 'Basic',    bg: '#B0B7C3', text: '#1F2937' }, // silver
  standard:   { label: 'Standard', bg: '#10B981', text: '#FFFFFF' }, // emerald
  premium:    { label: 'Premium',  bg: '#8B5CF6', text: '#FFFFFF' }, // platinum/violet
  elite:      { label: 'Elite',    bg: '#F5B700', text: '#1F2937' }, // gold
};

export default function TierBadge({ tier, className = '' }: { tier?: string | null; className?: string }) {
  const style = TIER_STYLES[tier || 'unverified'] ?? TIER_STYLES.unverified;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${className}`}
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}
