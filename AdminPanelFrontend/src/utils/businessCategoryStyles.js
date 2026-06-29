// admin/utils/businessCategoryStyles.js
//
// Mirrors app/_lib/business-categories.ts on the main site — kept as a
// separate copy because this is a standalone CRA app (no shared package
// between the two frontends). Keep these two lists in sync if categories
// change. No icons/emojis on purpose: each category is identified by its
// own gradient + glow color, applied via the .category-art CSS class
// (see AdminPanelFrontend/src/index.css) for the glass/clay/neumorphic look.
export const BUSINESS_CATEGORIES = [
  { id: 'technology',        label: 'Technology',        gradient: 'linear-gradient(135deg, #020024 0%, #1b1464 45%, #2575fc 100%)', glow: '#2575fc' },
  { id: 'food-beverage',     label: 'Food & Beverage',   gradient: 'linear-gradient(135deg, #3a1c0a 0%, #a3441c 50%, #f4a261 100%)', glow: '#f4a261' },
  { id: 'real-estate',       label: 'Real Estate',       gradient: 'linear-gradient(135deg, #232526 0%, #5c5346 55%, #c9a876 100%)', glow: '#c9a876' },
  { id: 'automotive',        label: 'Automotive',        gradient: 'linear-gradient(135deg, #0d0d0d 0%, #3a3a3a 50%, #b3001b 100%)', glow: '#e63950' },
  { id: 'health-wellness',   label: 'Health & Wellness', gradient: 'linear-gradient(135deg, #013a40 0%, #0f6b5c 50%, #6fdcc4 100%)', glow: '#5ee6c8' },
  { id: 'entertainment',     label: 'Entertainment',     gradient: 'linear-gradient(135deg, #1a0033 0%, #6a0572 50%, #e63cff 100%)', glow: '#e63cff' },
  { id: 'fashion',           label: 'Fashion',           gradient: 'linear-gradient(135deg, #2d0a1f 0%, #7d2150 50%, #f0a6ca 100%)', glow: '#f0a6ca' },
  { id: 'education',         label: 'Education',         gradient: 'linear-gradient(135deg, #0b132b 0%, #1c2541 50%, #e0b94f 100%)', glow: '#e0b94f' },
  { id: 'business-services', label: 'Business Services', gradient: 'linear-gradient(135deg, #10151a 0%, #243b4a 50%, #3fa9c9 100%)', glow: '#3fa9c9' },
  { id: 'travel-tourism',    label: 'Travel & Tourism',  gradient: 'linear-gradient(135deg, #021b3a 0%, #1c6ea4 50%, #ffb96b 100%)', glow: '#ffb96b' },
  { id: 'arts-culture',      label: 'Arts & Culture',    gradient: 'linear-gradient(135deg, #1f0a2e 0%, #5e2a84 50%, #ff7a59 100%)', glow: '#ff7a59' },
  { id: 'photography',       label: 'Photography',       gradient: 'linear-gradient(135deg, #0a0a0a 0%, #3d3d3d 55%, #d4af37 100%)', glow: '#d4af37' },
  { id: 'gifts-events',      label: 'Gifts & Events',    gradient: 'linear-gradient(135deg, #2b0a1a 0%, #8c1c4d 50%, #ffd166 100%)', glow: '#ffd166' },
  { id: 'government-public', label: 'Government & Public', gradient: 'linear-gradient(135deg, #06141b 0%, #11324d 55%, #9fb8c8 100%)', glow: '#9fb8c8' },
  { id: 'general-retail',    label: 'General Retail',    gradient: 'linear-gradient(135deg, #1b1b2f 0%, #2a6f6f 50%, #ff7e5f 100%)', glow: '#ff7e5f' },
  { id: 'other',             label: 'Others',            gradient: 'linear-gradient(135deg, #1c1c1c 0%, #3d3d3d 55%, #8a8a8a 100%)', glow: '#8a8a8a' },
];

const BY_ID = new Map(BUSINESS_CATEGORIES.map((c) => [c.id, c]));
const FALLBACK = BUSINESS_CATEGORIES[BUSINESS_CATEGORIES.length - 1];

export function getBusinessCategory(id) {
  if (!id) return FALLBACK;
  return BY_ID.get(id) || { ...FALLBACK, label: id };
}

// Inline style object for the gradient — admin panel uses plain inline
// styles everywhere, not Tailwind, so this is the per-element equivalent of
// CategoryCard.tsx's `style={{ backgroundImage, '--glow' }}` on the main site.
export function categoryArtStyle(id) {
  const cat = getBusinessCategory(id);
  return { backgroundImage: cat.gradient, '--glow': cat.glow };
}
