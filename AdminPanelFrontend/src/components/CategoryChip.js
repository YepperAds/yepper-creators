// admin/components/CategoryChip.js
//
// Mirrors app/_components/shared/CategoryCard.tsx on the main site — renders
// a business category as a real 3D-rendered image inside one shared
// claymorphism shell (.category-art in index.css). Every category uses the
// same clay color; the image is what tells them apart. Pass `onClick` to
// make it an interactive picker; omit it for a read-only badge (e.g. in the
// deals table).
import { getBusinessCategory } from '../utils/businessCategoryStyles';

const IMG_SIZE = { badge: 16, pill: 20 };

export default function CategoryChip({ id, selected, onClick, size = 'pill' }) {
  const cat = getBusinessCategory(id);
  const isBadge = size === 'badge';
  const Tag = onClick ? 'button' : 'span';
  const imgSize = IMG_SIZE[isBadge ? 'badge' : 'pill'];

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isBadge ? '3px 10px' : '6px 14px',
        fontSize: isBadge ? 11 : 13,
        fontWeight: 700,
        color: '#3a2f26',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      className={`category-art ${onClick ? 'category-art-interactive' : ''} ${selected ? 'category-art-selected' : ''}`}
    >
      <img src={cat.image} alt="" width={imgSize} height={imgSize} className="yp-float" style={{ flexShrink: 0 }} />
      {cat.label}
    </Tag>
  );
}
