import Image from 'next/image';
import { CheckIcon } from '@heroicons/react/24/solid';
import { getBusinessCategory } from '@/app/_lib/business-categories';

// Renders a business category as a real photo (see /public/category-photos)
// — a small thumbnail for pill/badge sizes, a full-bleed glass-shine
// background for size="card" (.category-photo-card in globals.css). Others /
// Any category have no natural photo, so they alone keep the old Fluent
// Emoji 3D render inside the claymorphism shell (.category-art) — see
// BusinessCategory.isIcon in business-categories.ts. Pass `onClick` to make
// it an interactive picker pill/card; omit it for a read-only badge.
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
    // Others / Any category have no real photo — keep the old clay+icon shell
    // instead of stretching a small 3D render as a fake background.
    if (cat.isIcon) {
      const cardContent = (
        <>
          {selected && (
            <span className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-coral flex items-center justify-center shadow-sm">
              <CheckIcon className="w-3 h-3 text-[#fff]" />
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

    const photoCardClasses = `category-photo-card ${selected ? 'category-photo-selected' : ''} relative overflow-hidden flex flex-col justify-end text-left h-44 w-full ${className}`;
    const photoCardContent = (
      <>
        <Image
          src={cat.image}
          alt=""
          fill
          sizes="(max-width: 640px) 45vw, 220px"
          className="object-cover"
        />
        <div className="category-photo-scrim absolute inset-0" />
        {selected && (
          <span className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-coral flex items-center justify-center shadow-sm">
            <CheckIcon className="w-3.5 h-3.5 text-[#fff]" />
          </span>
        )}
        <div className="relative z-10 p-4">
          <span className="text-lg font-extrabold text-[#fff] [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">{displayLabel}</span>
          {description && (
            <span className="block text-xs text-[#fff]/85 mt-1 line-clamp-2 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">{description}</span>
          )}
        </div>
      </>
    );
    return onClick ? (
      <button type="button" onClick={onClick} className={photoCardClasses}>{photoCardContent}</button>
    ) : (
      <div className={photoCardClasses}>{photoCardContent}</div>
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
