'use client';

import Image from 'next/image';
import cornerBadge from '../../images to use/image1.png';
import lBanner from '../../images to use/image3.png';

export default function AdFormatPreview({ type }: { type: 'corner' | 'lbar' }) {
  const src = type === 'corner' ? cornerBadge : lBanner;

  return (
    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border border-(--color-border) bg-(--color-surface-3)">
      <Image
        src={src}
        alt={type === 'corner' ? 'Corner badge preview' : 'L-banner preview'}
        className="h-full w-full object-cover"
        width={80}
        height={48}
        unoptimized
      />
    </div>
  );
}
