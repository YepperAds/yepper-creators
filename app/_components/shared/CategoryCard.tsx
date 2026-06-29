import { CheckIcon } from '@heroicons/react/24/solid';
import { getBusinessCategory } from '@/app/_lib/business-categories';

// Renders a business category as its own little glass/clay/neumorphic
// material (see .category-art in globals.css) instead of a generic icon —
// every picker and badge across the app should go through this so a given
// category always looks the same place to place. Pass `onClick` to make it
// an interactive picker pill/card; omit it for a plain read-only badge.
const TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.6)';

interface CategoryCardProps {
  id: string;
  label?: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'pill' | 'card' | 'badge';
  className?: string;
}

export default function CategoryCard({ id, label, description, selected, onClick, size = 'pill', className = '' }: CategoryCardProps) {
  const cat = getBusinessCategory(id);
  const displayLabel = label ?? cat.label;
  const style = { backgroundImage: cat.gradient, '--glow': cat.glow } as React.CSSProperties;
  const stateClasses = `category-art ${onClick ? 'category-art-interactive' : ''} ${selected ? 'category-art-selected' : ''}`;

  if (size === 'card') {
    const cardContent = (
      <>
        {selected && (
          <span className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-white/95 flex items-center justify-center shadow-sm">
            <CheckIcon className="w-3 h-3 text-black" />
          </span>
        )}
        <span style={{ textShadow: TEXT_SHADOW }} className="relative z-10 text-sm font-bold text-[#fff]">{displayLabel}</span>
        {description && (
          <span style={{ textShadow: TEXT_SHADOW }} className="relative z-10 text-[11px] text-[#fff]/85 mt-0.5 line-clamp-2">{description}</span>
        )}
      </>
    );
    const cardClassName = `${stateClasses} flex flex-col justify-end p-4 h-32 text-left w-full ${className}`;
    return onClick ? (
      <button type="button" onClick={onClick} style={style} className={cardClassName}>{cardContent}</button>
    ) : (
      <div style={style} className={cardClassName}>{cardContent}</div>
    );
  }

  const pillContent = (
    <span style={{ textShadow: TEXT_SHADOW }} className="relative z-10">{displayLabel}</span>
  );
  const sizeClasses = size === 'badge' ? 'px-2 py-0.5 text-[9px]' : 'px-4 py-2 text-xs';
  const pillClassName = `${stateClasses} ${sizeClasses} font-bold text-[#fff] inline-flex items-center gap-1.5 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className={pillClassName}>{pillContent}</button>
  ) : (
    <span style={style} className={pillClassName}>{pillContent}</span>
  );
}
