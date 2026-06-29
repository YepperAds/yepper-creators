// admin/components/CategoryChip.js
//
// Mirrors app/_components/shared/CategoryCard.tsx on the main site — renders
// a business category as its own glass/clay/neumorphic gradient chip instead
// of a generic icon or plain text. Pass `onClick` to make it an interactive
// picker; omit it for a read-only badge (e.g. in the deals table).
import { getBusinessCategory } from '../utils/businessCategoryStyles';

const TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.6)';

export default function CategoryChip({ id, selected, onClick, size = 'pill' }) {
  const cat = getBusinessCategory(id);
  const style = { backgroundImage: cat.gradient, '--glow': cat.glow };
  const isBadge = size === 'badge';
  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        padding: isBadge ? '3px 10px' : '6px 16px',
        fontSize: isBadge ? 11 : 13,
        fontWeight: 700,
        color: '#fff',
        textShadow: TEXT_SHADOW,
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      className={`category-art ${onClick ? 'category-art-interactive' : ''} ${selected ? 'category-art-selected' : ''}`}
    >
      {cat.label}
    </Tag>
  );
}
