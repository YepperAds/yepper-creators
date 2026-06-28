'use client';

import { useState } from 'react';
import { FireIcon } from '@heroicons/react/24/solid';
import type { HotDeal } from '@/app/_lib/public-home';
import HotDealPurchaseModal from './HotDealPurchaseModal';

function itemSummary(deal: HotDeal): string {
  const youtubeCount = deal.items.filter((i) => i.itemType === 'youtube').length;
  const websiteCount = deal.items.filter((i) => i.itemType === 'website').length;
  const parts: string[] = [];
  if (youtubeCount) parts.push(`${youtubeCount} YouTube slot${youtubeCount === 1 ? '' : 's'}`);
  if (websiteCount) parts.push(`${websiteCount} website space${websiteCount === 1 ? '' : 's'}`);
  return parts.join(' + ');
}

// Admin-curated bundles, shown to every visitor — signed in or not — as a
// trending section above the normal feed. See HotDealPurchaseModal for the
// all-or-nothing checkout.
export default function HotDealsSection({ deals }: { deals: HotDeal[] }) {
  const [active, setActive] = useState<HotDeal | null>(null);

  if (!deals.length) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <FireIcon className="w-5 h-5 text-coral" />
        <h2 className="text-lg font-bold text-white font-(--font-display)">Hot Deals</h2>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-coral/15 text-coral">Trending</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {deals.map((deal) => {
          const savings = deal.items.reduce((s, i) => s + (i.systemPrice - i.dealPrice), 0);
          return (
            <div key={deal.id} className="w-72 shrink-0 rounded-2xl border border-coral/20 bg-coral/8 p-4">
              <p className="text-[10px] font-bold uppercase text-coral mb-1">{deal.businessCategory.replace(/-/g, ' ')}</p>
              <h3 className="text-sm font-bold text-white truncate">{deal.title}</h3>
              {deal.description && (
                <p className="text-xs text-muted mt-1 line-clamp-2">{deal.description}</p>
              )}
              <p className="text-xs text-muted mt-2">{itemSummary(deal)}</p>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-emerald-400">{deal.totalPrice.toLocaleString()} RWF</p>
                  {savings > 0 && (
                    <p className="text-[10px] text-muted line-through">{(deal.totalPrice + savings).toLocaleString()} RWF</p>
                  )}
                </div>
                <button
                  onClick={() => setActive(deal)}
                  className="px-3 py-1.5 rounded-lg bg-coral text-xs font-bold text-white"
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
