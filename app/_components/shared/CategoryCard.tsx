import Image from 'next/image';
import { CheckIcon } from '@heroicons/react/24/solid';
import { getBusinessCategory } from '@/app/_lib/business-categories';

// Renders a business category as a real 3D-rendered image (Microsoft's
// Fluent Emoji 3D set — see /public/category-icons) inside one shared
// claymorphism shell (.category-art in globals.css). Every category uses
// the exact same clay color — the image is what makes Food & Beverage read
// as Food & Beverage, not a gradient or a generic icon. Pass `onClick` to
// make it an interactive picker pill/card; omit it for a read-only badge.
interface CategoryCardProps {
  id: string;
  label?: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'pill' | 'card' | 'badge';
  className?: string;
}

const IMG_SIZE = { badge: 18, pill: 26, card: 64 };

export default function CategoryCard({ id, label, description, selected, onClick, size = 'pill', className = '' }: CategoryCardProps) {
  const cat = getBusinessCategory(id);
  const displayLabel = label ?? cat.label;
  const stateClasses = `category-art ${onClick ? 'category-art-interactive' : ''} ${selected ? 'category-art-selected' : ''}`;
  const imgSize = IMG_SIZE[size];
  const image = <Image src={cat.image} alt="" width={imgSize} height={imgSize} className="yp-float shrink-0" />;

  if (size === 'card') {
    const cardContent = (
      <>
        {selected && (
          <span className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-coral flex items-center justify-center shadow-sm">
            <CheckIcon className="w-3 h-3 text-white" />
          </span>
        )}
        {image}
        <span className="mt-2 text-sm font-bold text-(--color-white)">{displayLabel}</span>
        {description && (
          <span className="text-[11px] text-(--color-muted) mt-0.5 line-clamp-2">{description}</span>
        )}
      </>
    );
    const cardClassName = `${stateClasses} flex flex-col items-center text-center p-4 h-36 justify-center w-full ${className}`;
    return onClick ? (
      <button type="button" onClick={onClick} className={cardClassName}>{cardContent}</button>
    ) : (
      <div className={cardClassName}>{cardContent}</div>
    );
  }

  const pillContent = (
    <>
      {image}
      <span className="text-(--color-white)">{displayLabel}</span>
    </>
  );
  const sizeClasses = size === 'badge' ? 'px-2 py-0.5 text-[9px] gap-1' : 'px-3 py-1.5 text-xs gap-1.5';
  const pillClassName = `${stateClasses} ${sizeClasses} font-bold inline-flex items-center ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={pillClassName}>{pillContent}</button>
  ) : (
    <span className={pillClassName}>{pillContent}</span>
  );
}
