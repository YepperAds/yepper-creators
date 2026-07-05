// Ad-space mockup images — one per placement, showing an advertiser roughly
// where their ad will actually sit on the page/player. Keyed by the
// canonical space label (see SPACE_TYPES / SPACE_ALIASES in
// backend/models/PricingModel.js) so it matches ad_categories.space_type
// regardless of how categoryName was typed.
const AD_SPACE_IMAGES: Record<string, string> = {
  'header': '/ad-spaces/header.png',
  'above the fold': '/ad-spaces/above-the-fold.png',
  'sticky sidebar': '/ad-spaces/sticky-sidebar.png',
  'mobile interstitial': '/ad-spaces/mobile-interstitial.png',
  'overlay': '/ad-spaces/overlay.png',
  'floating': '/ad-spaces/floating.png',
  'modal': '/ad-spaces/modal.png',
  'left rail': '/ad-spaces/left-rail.png',
  'right rail': '/ad-spaces/right-rail.png',
  'sidebar': '/ad-spaces/sidebar.png',
  'in feed': '/ad-spaces/in-feed.png',
  'inline content': '/ad-spaces/inline-content.png',
  'beneath title': '/ad-spaces/beneath-title.png',
  'pro footer': '/ad-spaces/pro-footer.png',
  'bottom': '/ad-spaces/bottom.png',
  // Video-player placements (creator/YouTube ad spaces).
  'pre-roll': '/ad-spaces/preroll.png',
  'preroll': '/ad-spaces/preroll.png',
  'mid-roll': '/ad-spaces/midroll.png',
  'midroll': '/ad-spaces/midroll.png',
  'pause': '/ad-spaces/pause.png',
};

/** Looks up the mockup image for an ad space, trying the canonical
 * `spaceType` first and falling back to `categoryName` (the free-text field
 * site owners can rename) — returns null if neither matches so callers can
 * skip the thumbnail instead of showing a broken image. */
export function getAdSpaceImage(spaceType?: string | null, categoryName?: string | null): string | null {
  const bySpaceType = spaceType ? AD_SPACE_IMAGES[spaceType.toLowerCase().trim()] : undefined;
  if (bySpaceType) return bySpaceType;
  const byCategoryName = categoryName ? AD_SPACE_IMAGES[categoryName.toLowerCase().trim()] : undefined;
  return byCategoryName ?? null;
}
