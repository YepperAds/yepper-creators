'use strict';

// Same business-category list advertisers pick from when creating a website
// ad (see app/(adsense)/ad-owner/pages/insert-data/page.tsx and
// backend/AdPromoter/controllers/businessCategoriesController.js's
// validCategories) — kept here too since YouTube claims live in a different
// domain (creators) and don't share a module with that AdOwner/AdPromoter
// flow today.

const BUSINESS_CATEGORIES = [
  { id: 'technology',         label: 'Technology' },
  { id: 'food-beverage',      label: 'Food & Beverage' },
  { id: 'real-estate',        label: 'Real Estate' },
  { id: 'automotive',         label: 'Automotive' },
  { id: 'health-wellness',    label: 'Health & Wellness' },
  { id: 'entertainment',      label: 'Entertainment' },
  { id: 'fashion',            label: 'Fashion' },
  { id: 'education',          label: 'Education' },
  { id: 'business-services',  label: 'Business Services' },
  { id: 'travel-tourism',     label: 'Travel & Tourism' },
  { id: 'arts-culture',       label: 'Arts & Culture' },
  { id: 'photography',        label: 'Photography' },
  { id: 'gifts-events',       label: 'Gifts & Events' },
  { id: 'government-public',  label: 'Government & Public' },
  { id: 'general-retail',     label: 'General Retail' },
  { id: 'other',              label: 'Others' },
];

const VALID_IDS = BUSINESS_CATEGORIES.map((c) => c.id);

/**
 * Validate an advertiser's business-category selection the same way the
 * website-ad form does: at least one valid category, and free-text required
 * if "other" is among them.
 * @returns {string | null} an error message, or null if valid
 */
function validateBusinessCategories(categories, other) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return 'Select at least one business category';
  }
  const invalid = categories.filter((c) => !VALID_IDS.includes(c));
  if (invalid.length) return `Invalid categories: ${invalid.join(', ')}`;
  if (categories.includes('other') && !String(other || '').trim()) {
    return 'Please describe your "Others" business category';
  }
  return null;
}

module.exports = { BUSINESS_CATEGORIES, VALID_IDS, validateBusinessCategories };
