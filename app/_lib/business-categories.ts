// Canonical business-category list + visual identity. Every picker and badge
// across the app (advertiser flows, hot deals, admin panel) should resolve
// through this — previously each surface kept its own duplicated category
// array and/or a separate Lucide-icon map, which drifted out of sync.
//
// Each category gets a real 3D-rendered image (Microsoft's Fluent Emoji 3D
// set, MIT-licensed — see /public/category-icons) instead of a flat icon or
// emoji glyph, displayed in a single unified claymorphism card (see
// CategoryCard.tsx / .category-art in globals.css) — one consistent
// material/color language, the image is what tells categories apart.
export interface BusinessCategory {
  id: string;
  label: string;
  /** Path under /public to this category's 3D render. */
  image: string;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { id: 'technology',        label: 'Technology',          image: '/category-icons/technology.png' },
  { id: 'food-beverage',     label: 'Food & Beverage',     image: '/category-icons/food-beverage.png' },
  { id: 'real-estate',       label: 'Real Estate',         image: '/category-icons/real-estate.png' },
  { id: 'automotive',        label: 'Automotive',          image: '/category-icons/automotive.png' },
  { id: 'health-wellness',   label: 'Health & Wellness',   image: '/category-icons/health-wellness.png' },
  { id: 'entertainment',     label: 'Entertainment',       image: '/category-icons/entertainment.png' },
  { id: 'fashion',           label: 'Fashion',             image: '/category-icons/fashion.png' },
  { id: 'education',         label: 'Education',           image: '/category-icons/education.png' },
  { id: 'business-services', label: 'Business Services',   image: '/category-icons/business-services.png' },
  { id: 'travel-tourism',    label: 'Travel & Tourism',    image: '/category-icons/travel-tourism.png' },
  { id: 'arts-culture',      label: 'Arts & Culture',      image: '/category-icons/arts-culture.png' },
  { id: 'photography',       label: 'Photography',         image: '/category-icons/photography.png' },
  { id: 'gifts-events',      label: 'Gifts & Events',      image: '/category-icons/gifts-events.png' },
  { id: 'government-public', label: 'Government & Public', image: '/category-icons/government-public.png' },
  { id: 'general-retail',    label: 'General Retail',      image: '/category-icons/general-retail.png' },
  { id: 'other',             label: 'Others',              image: '/category-icons/other.png' },
];

const ANY_CATEGORY: BusinessCategory = {
  id: 'any',
  label: 'Any category',
  image: '/category-icons/any.png',
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
