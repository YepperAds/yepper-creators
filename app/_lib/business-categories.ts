// Canonical business-category list + visual identity. Every picker and badge
// across the app (advertiser flows, hot deals, admin panel) should resolve
// through this — previously each surface kept its own duplicated category
// array and/or a separate Lucide-icon map, which drifted out of sync.
//
// Each category gets a real photo (see /public/category-photos) shown as a
// full-bleed background behind a frosted-glass panel (see CategoryCard.tsx /
// .category-art in globals.css) — replaces the old Fluent Emoji 3D render
// set. "Others" and "Any category" have no natural photo (they're catch-alls,
// not a real business type) so they keep the old 3D icon.
export interface BusinessCategory {
  id: string;
  label: string;
  /** Path under /public to this category's background photo (or, for the
   * 'other'/'any' catch-alls, their old 3D icon render). */
  image: string;
  /** True for the two catch-all entries still on the old icon set — lets
   * rendering surfaces skip the photo-background treatment for them. */
  isIcon?: boolean;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { id: 'technology',        label: 'Technology',          image: '/category-photos/technology.jpg' },
  { id: 'food-beverage',     label: 'Food & Beverage',     image: '/category-photos/food-beverage.jpg' },
  { id: 'real-estate',       label: 'Real Estate',         image: '/category-photos/real-estate.jpg' },
  { id: 'automotive',        label: 'Automotive',          image: '/category-photos/automotive.jpg' },
  { id: 'health-wellness',   label: 'Health & Wellness',   image: '/category-photos/health-wellness.jpg' },
  { id: 'entertainment',     label: 'Entertainment',       image: '/category-photos/entertainment.jpg' },
  { id: 'fashion',           label: 'Fashion',             image: '/category-photos/fashion.png' },
  { id: 'education',         label: 'Education',           image: '/category-photos/education.jpg' },
  { id: 'business-services', label: 'Business Services',   image: '/category-photos/business-services.jpg' },
  { id: 'travel-tourism',    label: 'Travel & Tourism',    image: '/category-photos/travel-tourism.jpg' },
  { id: 'arts-culture',      label: 'Arts & Culture',      image: '/category-photos/arts-culture.jpg' },
  { id: 'photography',       label: 'Photography',         image: '/category-photos/photography.jpg' },
  { id: 'gifts-events',      label: 'Gifts & Events',      image: '/category-photos/gifts-events.jpg' },
  { id: 'government-public', label: 'Government & Public', image: '/category-photos/government-public.jpg' },
  { id: 'general-retail',    label: 'General Retail',      image: '/category-photos/general-retail.jpg' },
  { id: 'other',             label: 'Others',              image: '/category-icons/other.png', isIcon: true },
];

const ANY_CATEGORY: BusinessCategory = {
  id: 'any',
  label: 'Any category',
  image: '/category-icons/any.png',
  isIcon: true,
};

const BY_ID = new Map([...BUSINESS_CATEGORIES, ANY_CATEGORY].map((c) => [c.id, c]));
const FALLBACK = BUSINESS_CATEGORIES[BUSINESS_CATEGORIES.length - 1];

/** Looks up a category's visual identity by id, falling back to the
 * neutral "Others" art for ids that don't (or no longer) match the list —
 * e.g. legacy free-text categories typed into the "Other" field. */
export function getBusinessCategory(id: string | null | undefined): BusinessCategory {
  if (!id) return FALLBACK;
  return BY_ID.get(id) ?? { ...FALLBACK, label: id };
}
