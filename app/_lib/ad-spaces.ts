// Ad-space mockup images: one per placement, showing an advertiser roughly
// where their ad will actually sit on the page/player. Keyed by the
// canonical space label (see SPACE_TYPES / SPACE_ALIASES in
// backend/models/PricingModel.js) so it matches ad_categories.space_type
// regardless of how categoryName was typed.
const AD_SPACE_IMAGES: Record<string, string> = {
  'header': '/ad-spaces/header.png',
  'above the fold': '/ad-spaces/above-the-fold.png',
  'sticky sidebar': '/ad-spaces/sticky-sidebar.png',
  'floating': '/ad-spaces/floating.png',
  'modal': '/ad-spaces/modal.png',
  'left rail': '/ad-spaces/left-rail.png',
  'sidebar': '/ad-spaces/sidebar.png',
  'inline content': '/ad-spaces/inline-content.png',
  'beneath title': '/ad-spaces/beneath-title.png',
  'pro footer': '/ad-spaces/pro-footer.png',
  // Video-player placements (creator/YouTube ad spaces).
  'pre-roll': '/ad-spaces/preroll.png',
  'preroll': '/ad-spaces/preroll.png',
  'mid-roll': '/ad-spaces/midroll.png',
  'midroll': '/ad-spaces/midroll.png',
  'pause': '/ad-spaces/pause.png',
};

/** Looks up the mockup image for an ad space, trying the canonical
 * `spaceType` first and falling back to `categoryName` (the free-text field
 * site owners can rename); returns null if neither matches so callers can
 * skip the thumbnail instead of showing a broken image. */
export function getAdSpaceImage(spaceType?: string | null, categoryName?: string | null): string | null {
  const bySpaceType = spaceType ? AD_SPACE_IMAGES[spaceType.toLowerCase().trim()] : undefined;
  if (bySpaceType) return bySpaceType;
  const byCategoryName = categoryName ? AD_SPACE_IMAGES[categoryName.toLowerCase().trim()] : undefined;
  return byCategoryName ?? null;
}

// Short, plain-language explanations of each placement: a web owner's ad
// category can carry its own free-text `description`, but plenty are
// created without one (e.g. admin-added prospect sites just reuse the
// space-type name), so advertisers need a guaranteed, easy-to-scan fallback
// no matter who created the listing.
const AD_SPACE_DESCRIPTIONS: Record<string, string> = {
  'header': 'Banner across the top of the page',
  'above the fold': 'Visible before the visitor scrolls',
  'sticky sidebar': 'Sidebar ad that follows as you scroll',
  'floating': 'Floats on screen as you scroll',
  'modal': 'Pop-up ad in its own window',
  'left rail': 'Ad along the left edge of the page',
  'right rail': 'Ad along the right edge of the page',
  'sidebar': 'Ad in the side column',
  'inline content': 'Placed inside the article text',
  'beneath title': 'Just below the page title',
  'pro footer': 'Premium spot in the footer',
  'footer': 'Standard spot in the footer',
  // Video-player placements.
  'pre-roll': 'Plays before the video starts',
  'preroll': 'Plays before the video starts',
  'mid-roll': 'Plays in the middle of the video',
  'midroll': 'Plays in the middle of the video',
  'pause': 'Shows up when the viewer pauses',
};

/** Same lookup strategy as `getAdSpaceImage`, but for a short fallback
 * description; returns null if nothing matches so callers can fall back
 * further (e.g. to their own copy) instead of showing a blank string. */
export function getAdSpaceDescription(spaceType?: string | null, categoryName?: string | null): string | null {
  const bySpaceType = spaceType ? AD_SPACE_DESCRIPTIONS[spaceType.toLowerCase().trim()] : undefined;
  if (bySpaceType) return bySpaceType;
  const byCategoryName = categoryName ? AD_SPACE_DESCRIPTIONS[categoryName.toLowerCase().trim()] : undefined;
  return byCategoryName ?? null;
}
