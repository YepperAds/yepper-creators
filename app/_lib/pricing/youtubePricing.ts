export type DurationBand = '5–15s' | '15–30s' | '30–60s' | '60–120s';
export type TierName = 'Nano' | 'Micro' | 'Mid' | 'Macro' | 'Mega';

export interface PricingRow {
  duration: DurationBand;
  video_ad: number;
  audio_ad: number;
  mention: number;
}

export interface YouTubePricingResult {
  eligible: boolean;
  tier: TierName | null;
  estimatedViewsPerVideo: number;
  rows: PricingRow[];
}

// Tiers keyed by minimum estimated views per video (highest → lowest for find())
const TIER_TABLE: { name: TierName; minViews: number; rows: PricingRow[] }[] = [
  {
    name: 'Mega', minViews: 150_000,
    rows: [
      { duration: '5–15s',   video_ad: 210_000, audio_ad: 108_000, mention:  54_000 },
      { duration: '15–30s',  video_ad: 350_000, audio_ad: 180_000, mention:  90_000 },
      { duration: '30–60s',  video_ad: 525_000, audio_ad: 270_000, mention: 135_000 },
      { duration: '60–120s', video_ad: 770_000, audio_ad: 396_000, mention: 198_000 },
    ],
  },
  {
    name: 'Macro', minViews: 50_000,
    rows: [
      { duration: '5–15s',   video_ad:  96_000, audio_ad:  51_000, mention:  27_000 },
      { duration: '15–30s',  video_ad: 160_000, audio_ad:  85_000, mention:  45_000 },
      { duration: '30–60s',  video_ad: 240_000, audio_ad: 127_500, mention:  67_500 },
      { duration: '60–120s', video_ad: 352_000, audio_ad: 187_000, mention:  99_000 },
    ],
  },
  {
    name: 'Mid', minViews: 20_000,
    rows: [
      { duration: '5–15s',   video_ad:  45_000, audio_ad:  24_000, mention:  13_200 },
      { duration: '15–30s',  video_ad:  75_000, audio_ad:  40_000, mention:  22_000 },
      { duration: '30–60s',  video_ad: 112_500, audio_ad:  60_000, mention:  33_000 },
      { duration: '60–120s', video_ad: 165_000, audio_ad:  88_000, mention:  48_400 },
    ],
  },
  {
    name: 'Micro', minViews: 5_000,
    rows: [
      { duration: '5–15s',   video_ad:  21_000, audio_ad:  10_800, mention:   6_000 },
      { duration: '15–30s',  video_ad:  35_000, audio_ad:  18_000, mention:  10_000 },
      { duration: '30–60s',  video_ad:  52_500, audio_ad:  27_000, mention:  15_000 },
      { duration: '60–120s', video_ad:  77_000, audio_ad:  39_600, mention:  22_000 },
    ],
  },
  {
    name: 'Nano', minViews: 1_000,
    rows: [
      { duration: '5–15s',   video_ad:   9_000, audio_ad:   4_800, mention:   3_000 },
      { duration: '15–30s',  video_ad:  15_000, audio_ad:   8_000, mention:   5_000 },
      { duration: '30–60s',  video_ad:  22_500, audio_ad:  12_000, mention:   7_500 },
      { duration: '60–120s', video_ad:  33_000, audio_ad:  17_600, mention:  11_000 },
    ],
  },
];

/**
 * Determine a creator's ad pricing tier based on estimated views per video.
 *
 * Eligibility gate: channel must have ≥1,000 subscribers.
 * Tier is then assigned by estimated views per video:
 *   Nano 1K–5K · Micro 5K–20K · Mid 20K–50K · Macro 50K–150K · Mega 150K+
 *
 * @param S           - subscriber count
 * @param TV          - total lifetime channel views (used as fallback)
 * @param MV          - mean views per video (pre-computed fallback)
 * @param recentViews - array of view counts for recent videos (preferred source)
 */
export function calculateYouTubePrice(
  S: number,
  TV: number,
  MV: number,
  recentViews?: number[],
): YouTubePricingResult {
  const subscribers = Number.isFinite(S) && S > 0 ? Math.round(S) : 0;

  const views = Array.isArray(recentViews)
    ? recentViews.filter((v): v is number => Number.isFinite(v) && v >= 0)
    : [];
  const effectiveMV = views.length
    ? views.reduce((s, x) => s + x, 0) / views.length
    : Number.isFinite(MV) && MV > 0 ? MV : 0;

  const estimatedViewsPerVideo = Math.round(effectiveMV);
  const eligible = subscribers >= 1_000;

  if (!eligible) {
    return { eligible: false, tier: null, estimatedViewsPerVideo, rows: [] };
  }

  const tierDef = TIER_TABLE.find(t => estimatedViewsPerVideo >= t.minViews) ?? null;
  return {
    eligible: true,
    tier: tierDef?.name ?? null,
    estimatedViewsPerVideo,
    rows: tierDef?.rows ?? [],
  };
}
