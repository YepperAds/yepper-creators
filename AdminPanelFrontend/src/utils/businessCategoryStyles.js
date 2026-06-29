// admin/utils/businessCategoryStyles.js
//
// Mirrors app/_lib/business-categories.ts on the main site — kept as a
// separate copy because this is a standalone CRA app (no shared package
// between the two frontends). Keep these two lists in sync if categories
// change. Each category is a real 3D-rendered image (Microsoft's Fluent
// Emoji 3D set, MIT-licensed — see public/category-icons), shown inside one
// shared claymorphism shell (.category-art in index.css) — every category
// uses the same clay color, the image is what tells them apart.
export const BUSINESS_CATEGORIES = [
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

const BY_ID = new Map(BUSINESS_CATEGORIES.map((c) => [c.id, c]));
const FALLBACK = BUSINESS_CATEGORIES[BUSINESS_CATEGORIES.length - 1];

export function getBusinessCategory(id) {
  if (!id) return FALLBACK;
  return BY_ID.get(id) || { ...FALLBACK, label: id };
}
