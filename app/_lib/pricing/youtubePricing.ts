export interface YouTubePricingResult {
  S: number;
  TV: number;
  MV: number;
  SS: number;   // Subscribers score
  TVS: number;  // Total views score
  MVS: number;  // Mean views score
  CVS: number;  // Creator Value Score
  Price_RWF: number;
}

/**
 * Calculate YouTube creator pricing according to Yepper rules.
 * Inputs:
 *  - S  : total subscribers
 *  - TV : total lifetime channel views
 *  - MV : mean views per video
 *
 * Returns an object containing SS, TVS, MVS, CVS and Price_RWF (rounded to 2 decimals).
 */
export function calculateYouTubePrice(S: number, TV: number, MV: number, recentViews?: number[], options?: { minSubscribers?: number; minMeanViews?: number; }): YouTubePricingResult {
  // Normalise inputs and guard against negatives / NaN
  const Snum = Number.isFinite(S) && S > 0 ? S : 0;
  const TVnum = Number.isFinite(TV) && TV > 0 ? TV : 0;
  const MVnum = Number.isFinite(MV) && MV > 0 ? MV : 0;

  // Configurable eligibility thresholds (defaults)
  const minSubscribers = options?.minSubscribers ?? 1000;
  const minMeanViews = options?.minMeanViews ?? 500;

  const SS = Math.log10(Snum + 1) * 100;
  const TVS = Math.log10(TVnum + 1) * 80;
  const MVS = Math.log10(MVnum + 1) * 200;

  const CVS = (0.25 * SS) + (0.25 * TVS) + (0.50 * MVS);
  const rawPrice = CVS * 50;

  // Compute recent video stats when recentViews provided
  const views = Array.isArray(recentViews) ? recentViews.map(v => Number.isFinite(v) ? v : 0) : [];
  const videos_count = views.length;
  const mean_views = videos_count ? views.reduce((s, x) => s + x, 0) / videos_count : MVnum;
  const sorted = [...views].sort((a, b) => a - b);
  const median_views = videos_count ? (videos_count % 2 === 1 ? sorted[(videos_count - 1) / 2] : (sorted[videos_count / 2 - 1] + sorted[videos_count / 2]) / 2) : MVnum;
  const variance = videos_count ? views.reduce((s, x) => s + Math.pow(x - mean_views, 2), 0) / videos_count : 0;
  const std_dev = Math.sqrt(variance);

  // Predict next-post views using simple mean + range (normal approx)
  const predicted_next_views = mean_views;
  const predicted_next_low = Math.max(0, mean_views - 1.96 * std_dev);
  const predicted_next_high = mean_views + 1.96 * std_dev;

  // Eligibility gate: require minimum subscribers AND minimum mean views
  const eligible = Snum >= minSubscribers && MVnum >= minMeanViews && mean_views >= minMeanViews;
  const Price_RWF = eligible ? rawPrice : 0;

  const round2 = (v: number) => Number(v.toFixed(2));

  return {
    S: Snum,
    TV: TVnum,
    MV: MVnum,
    SS: round2(SS),
    TVS: round2(TVS),
    MVS: round2(MVS),
    CVS: round2(CVS),
    Price_RWF: round2(Price_RWF),
    // Additional diagnostic stats
    // @ts-expect-error - allow extension of return for richer UI
    eligibility_status: eligible ? 'VERIFIED' : 'UNVERIFIED',
    // @ts-expect-error
    videos_count: videos_count,
    // @ts-expect-error
    mean_views: round2(mean_views),
    // @ts-expect-error
    median_views: round2(median_views),
    // @ts-expect-error
    std_dev: round2(std_dev),
    // @ts-expect-error
    predicted_next_views: round2(predicted_next_views),
    // @ts-expect-error
    predicted_next_low: round2(predicted_next_low),
    // @ts-expect-error
    predicted_next_high: round2(predicted_next_high),
    // @ts-expect-error
    recent_videos: views,
  } as unknown as YouTubePricingResult;
}

// Example:
// calculateYouTubePrice(12000, 1_200_000, 4500)
// -> { SS: ..., TVS: ..., MVS: ..., CVS: ..., Price_RWF: ... }
