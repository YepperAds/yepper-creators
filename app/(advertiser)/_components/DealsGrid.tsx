'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FireIcon } from '@heroicons/react/24/solid';
import type { HotDeal } from '@/app/_lib/public-home';
import { getBusinessCategory } from '@/app/_lib/business-categories';
import HotDealPurchaseModal from '@/app/_components/home/HotDealPurchaseModal';
import PageHeader from '@/app/_components/dashboard/PageHeader';

function itemSummary(deal: HotDeal): string {
  const youtubeCount = deal.items.filter((i) => i.itemType === 'youtube').length;
  const websiteCount = deal.items.filter((i) => i.itemType === 'website').length;
  const parts: string[] = [];
  if (youtubeCount) parts.push(`${youtubeCount} YouTube slot${youtubeCount === 1 ? '' : 's'}`);
  if (websiteCount) parts.push(`${websiteCount} website space${websiteCount === 1 ? '' : 's'}`);
  return parts.join(' + ');
}

export default function DealsGrid({ deals, onBack }: { deals: HotDeal[]; onBack?: () => void }) {
  const [active, setActive] = useState<HotDeal | null>(null);

  if (deals.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <PageHeader title="Hot Deals" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <FireIcon className="w-10 h-10 text-(--color-coral) mb-3" />
          <h1 className="text-xl font-bold text-(--color-white)">No Hot Deals right now</h1>
          <p className="text-sm text-(--color-muted) mt-1.5 max-w-sm">
            Admin-curated bundles of YouTube slots and website ad spaces show up here, with a fixed package price, as soon as one goes live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader title="Curated Media Bundles & Deals" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => {
            const savings = deal.items.reduce((s, i) => s + (i.systemPrice - i.dealPrice), 0);
            const category = getBusinessCategory(deal.businessCategory);
            return (
              <div key={deal.id} className="category-art p-5 flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                  <Image src={category.image} alt="" width={22} height={22} className="yp-float shrink-0" />
                  <p className="text-[10px] font-bold uppercase text-(--color-muted)">{category.label}</p>
                </div>
                <h3 className="text-base font-bold text-(--color-white)">{deal.title}</h3>
                {deal.description && (
                  <p className="text-xs text-(--color-subtle) mt-1.5 line-clamp-3">{deal.description}</p>
                )}
                <p className="text-xs text-(--color-muted) mt-3">{itemSummary(deal)}</p>

                <div className="mt-4 pt-4 border-t border-(--color-border) flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-emerald-400">{deal.totalPrice.toLocaleString()} RWF</p>
                    {savings > 0 && (
                      <p className="text-[11px] text-(--color-muted) line-through">{(deal.totalPrice + savings).toLocaleString()} RWF</p>
                    )}
                  </div>
                  <button
                    onClick={() => setActive(deal)}
                    className="px-4 py-2 rounded-lg bg-(--color-coral) text-xs font-bold text-white"
                  >
                    View deal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <HotDealPurchaseModal deal={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}
