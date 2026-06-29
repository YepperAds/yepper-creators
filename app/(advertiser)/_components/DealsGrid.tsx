'use client';

import { useState } from 'react';
import { FireIcon } from '@heroicons/react/24/solid';
import type { HotDeal } from '@/app/_lib/public-home';
import { getBusinessCategory } from '@/app/_lib/business-categories';
import HotDealPurchaseModal from '@/app/_components/home/HotDealPurchaseModal';

function itemSummary(deal: HotDeal): string {
  const youtubeCount = deal.items.filter((i) => i.itemType === 'youtube').length;
  const websiteCount = deal.items.filter((i) => i.itemType === 'website').length;
  const parts: string[] = [];
  if (youtubeCount) parts.push(`${youtubeCount} YouTube slot${youtubeCount === 1 ? '' : 's'}`);
  if (websiteCount) parts.push(`${websiteCount} website space${websiteCount === 1 ? '' : 's'}`);
  return parts.join(' + ');
}

export default function DealsGrid({ deals }: { deals: HotDeal[] }) {
  const [active, setActive] = useState<HotDeal | null>(null);

  if (deals.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-6">
        <FireIcon className="w-10 h-10 text-(--color-coral) mb-3" />
        <h1 className="text-xl font-bold text-(--color-white)">No Hot Deals right now</h1>
        <p className="text-sm text-(--color-muted) mt-1.5 max-w-sm">
          Admin-curated bundles of YouTube slots and website ad spaces show up here, with a fixed package price, as soon as one goes live.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-6">
        <FireIcon className="w-6 h-6 text-(--color-coral)" />
        <h1 className="text-2xl font-bold text-(--color-white)">Hot Deals</h1>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-(--color-coral)/15 text-(--color-coral)">Trending</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {deals.map((deal) => {
          const savings = deal.items.reduce((s, i) => s + (i.systemPrice - i.dealPrice), 0);
          const category = getBusinessCategory(deal.businessCategory);
          const textShadow = '0 1px 3px rgba(0,0,0,0.6)';
          return (
            <div
              key={deal.id}
              style={{ backgroundImage: category.gradient, '--glow': category.glow } as React.CSSProperties}
              className="category-art p-5 flex flex-col"
            >
              <p style={{ textShadow }} className="relative z-10 text-[10px] font-bold uppercase text-[#fff]/80 mb-1">{category.label}</p>
              <h3 style={{ textShadow }} className="relative z-10 text-base font-bold text-[#fff]">{deal.title}</h3>
              {deal.description && (
                <p style={{ textShadow }} className="relative z-10 text-xs text-[#fff]/85 mt-1.5 line-clamp-3">{deal.description}</p>
              )}
              <p style={{ textShadow }} className="relative z-10 text-xs text-[#fff]/70 mt-3">{itemSummary(deal)}</p>

              <div className="relative z-10 mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                <div>
                  <p style={{ textShadow }} className="text-lg font-bold text-emerald-300">{deal.totalPrice.toLocaleString()} RWF</p>
                  {savings > 0 && (
                    <p style={{ textShadow }} className="text-[11px] text-[#fff]/70 line-through">{(deal.totalPrice + savings).toLocaleString()} RWF</p>
                  )}
                </div>
                <button
                  onClick={() => setActive(deal)}
                  className="px-4 py-2 rounded-lg bg-[#fff] text-xs font-bold text-black shadow-sm"
                >
                  View deal
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <HotDealPurchaseModal deal={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}
