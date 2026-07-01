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
            <div key={deal.id} className={`category-art w-72 shrink-0 overflow-hidden p-0 relative ${category.isIcon ? '' : 'h-64'}`}>
              {!category.isIcon && (
                <>
                  <Image src={category.image} alt="" fill sizes="288px" className="object-cover" />
                  {/* Flat wash over the whole photo (not just a bottom gradient) so
                      every line of white text stays legible wherever it lands. */}
                  <div className="absolute inset-0 bg-black/55" />
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="yp-shimmer absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  </div>
                </>
              )}

              <div className={category.isIcon ? 'p-4' : 'relative z-10 h-full flex flex-col p-4'}>
                <div className="flex items-center gap-1.5 mb-1">
                  {category.isIcon && <Image src={category.image} alt="" width={20} height={20} className="yp-float shrink-0" />}
                  <p className={`text-[10px] font-extrabold uppercase tracking-wide ${category.isIcon ? 'text-(--color-muted)' : 'text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]'}`}>
                    {category.label}
                  </p>
                </div>
                <h3 className={`text-sm font-bold truncate ${category.isIcon ? 'text-(--color-white)' : 'text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]'}`}>{deal.title}</h3>
                {deal.description && (
                  <p className={`text-xs mt-1 line-clamp-2 ${category.isIcon ? 'text-(--color-subtle)' : 'text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]'}`}>{deal.description}</p>
                )}
                <p className={`text-xs mt-2 ${category.isIcon ? 'text-(--color-muted)' : 'text-white/75'}`}>{itemSummary(deal)}</p>

                <div className={`flex items-center justify-between pt-3 ${category.isIcon ? 'mt-3' : 'mt-auto'}`}>
                  <div>
                    <p className={`text-base font-bold ${category.isIcon ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-400'}`}>{deal.totalPrice.toLocaleString()} RWF</p>
                    {savings > 0 && (
                      <p className={`text-[10px] line-through ${category.isIcon ? 'text-(--color-muted)' : 'text-white/60'}`}>{(deal.totalPrice + savings).toLocaleString()} RWF</p>
                    )}
                  </div>
                  <button
                    onClick={() => viewDeal(deal)}
                    className="px-3 py-1.5 rounded-lg bg-coral text-xs font-bold text-white shrink-0"
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
