'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FireIcon } from '@heroicons/react/24/solid';
import type { HotDeal } from '@/app/_lib/public-home';
import { getBusinessCategory } from '@/app/_lib/business-categories';
import HotDealPurchaseModal from './HotDealPurchaseModal';

function redirectToLoginForDeal(dealId: string) {
  window.location.href = `/login?from=${encodeURIComponent(`/?dealId=${dealId}`)}`;
}

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
//
// `initialDealId` deep-links straight into a specific deal's purchase modal
// (e.g. from an emailed link — see adminSendDealEmail in
// hotDealsController.js) wherever this section is rendered: the logged-out
// home feed and every dashboard panel that shows it alike.
//
// `requireLogin` is set by the logged-out home feed (HomePage.tsx is only
// ever rendered when there's no session — see app/page.tsx) so "View deal"
// sends the visitor to log in first, then lands them right back on this
// same deal's purchase modal via the `dealId` deep link above, instead of
// only discovering they need to log in after filling out the whole form.
export default function HotDealsSection({ deals, initialDealId, requireLogin }: { deals: HotDeal[]; initialDealId?: string; requireLogin?: boolean }) {
  const [active, setActive] = useState<HotDeal | null>(
    () => (initialDealId ? deals.find((d) => d.id === initialDealId) ?? null : null),
  );

  // Strip `dealId` back out of the URL once consumed, without disturbing any
  // other params (e.g. `panel=advertise`) — plain History API so this never
  // needs a useSearchParams()/Suspense boundary just for a one-time cleanup.
  useEffect(() => {
    if (!initialDealId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('dealId');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!deals.length) return null;

  const viewDeal = (deal: HotDeal) => {
    if (requireLogin) {
      redirectToLoginForDeal(deal.id);
      return;
    }
    setActive(deal);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <FireIcon className="w-5 h-5 text-coral" />
        <h2 className="text-lg font-bold text-white font-(--font-display)">Hot Deals</h2>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-coral/15 text-coral-text">Trending</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {deals.map((deal) => {
          const savings = deal.items.reduce((s, i) => s + (i.systemPrice - i.dealPrice), 0);
          const category = getBusinessCategory(deal.businessCategory);
          return (
            <div key={deal.id} className="category-art w-72 shrink-0 overflow-hidden p-0">
              {category.isIcon ? (
                <div className="flex items-center gap-1.5 px-4 pt-4">
                  <Image src={category.image} alt="" width={20} height={20} className="yp-float shrink-0" />
                  <p className="text-[10px] font-bold uppercase text-(--color-muted)">{category.label}</p>
                </div>
              ) : (
                <div className="relative h-24 w-full">
                  <Image src={category.image} alt="" fill sizes="288px" className="object-cover" />
                  <div className="category-photo-scrim absolute inset-0" />
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="yp-shimmer absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  </div>
                  <p className="absolute bottom-2 left-3 z-10 text-sm font-extrabold uppercase text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
                    {category.label}
                  </p>
                </div>
              )}

              <div className="p-4 pt-3">
                <h3 className="text-sm font-bold text-(--color-white) truncate">{deal.title}</h3>
                {deal.description && (
                  <p className="text-xs text-(--color-subtle) mt-1 line-clamp-2">{deal.description}</p>
                )}
                <p className="text-xs text-(--color-muted) mt-2">{itemSummary(deal)}</p>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{deal.totalPrice.toLocaleString()} RWF</p>
                    {savings > 0 && (
                      <p className="text-[10px] text-(--color-muted) line-through">{(deal.totalPrice + savings).toLocaleString()} RWF</p>
                    )}
                  </div>
                  <button
                    onClick={() => viewDeal(deal)}
                    className="px-3 py-1.5 rounded-lg bg-coral text-xs font-bold text-white"
                  >
                    View deal
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <HotDealPurchaseModal deal={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}
