'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FireIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import type { HotDeal, PublicWebsite, PublicCreator } from '@/app/_lib/public-home';
import { getBusinessCategory } from '@/app/_lib/business-categories';
import HotDealPurchaseModal from './HotDealPurchaseModal';
import PlatformCarousel from './HotDealPlatformCard';

function redirectToLoginForDeal(dealId: string) {
  window.location.href = `/login?from=${encodeURIComponent(`/?dealId=${dealId}`)}`;
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
// ever rendered when there's no session — see app/page.tsx) so "Pick the
// package" sends the visitor to log in first, then lands them right back on
// this same deal's purchase modal via the `dealId` deep link above, instead
// of only discovering they need to log in after filling out the whole form.
//
// `websites`/`creators` resolve each deal item's real content (channel
// avatar + an actual video, or the site's real name) for the platform tiles
// below the price — see HotDealPlatformCard.tsx. Every color on this card is
// a literal value, not a --color-* theme token: the whole point of the photo
// + fixed white price panel is that it reads identically in light and dark
// mode, per explicit design direction.
export default function HotDealsSection({
  deals,
  initialDealId,
  requireLogin,
  websites = [],
  creators = [],
}: {
  deals: HotDeal[];
  initialDealId?: string;
  requireLogin?: boolean;
  websites?: PublicWebsite[];
  creators?: PublicCreator[];
}) {
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

  const pickDeal = (deal: HotDeal) => {
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

      <div className="space-y-3">
        {deals.map((deal) => {
          const category = getBusinessCategory(deal.businessCategory);
          const savings = deal.items.reduce((s, i) => s + (i.systemPrice - i.dealPrice), 0);
          const originalPrice = deal.totalPrice + savings;
          const pctOff = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

          return (
            <div key={deal.id} className="hotdeal-glow relative overflow-hidden rounded-2xl max-w-2xl">
              {/* Corner sale ribbon — clipped to a triangle by the card's own
                  overflow-hidden, the classic e-commerce "you're saving real
                  money" cue that a plain price line doesn't give you. */}
              {pctOff > 0 && (
                <div className="absolute -right-11 top-4 z-20 rotate-45 bg-coral px-11 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#fff] shadow-md">
                  Save {pctOff}%
                </div>
              )}

              <div className="relative h-24 sm:h-32 bg-[#111318]">
                {!category.isIcon && (
                  <>
                    <Image src={category.image} alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/55 to-black/70" />
                  </>
                )}

                <div className="relative z-10 h-full flex flex-col justify-between p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="yp-pulse-pop inline-flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 mb-1 text-[9px] font-extrabold uppercase tracking-wide text-[#fff]">
                        <FireIcon className="w-2.5 h-2.5" /> Hot deal
                      </span>
                      <p className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#facc15] [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                        {category.label}
                      </p>
                    </div>
                    <button
                      onClick={() => pickDeal(deal)}
                      className="yp-cta-glow-pulse shrink-0 flex items-center gap-1 px-4 py-2 rounded-full bg-[#fff] text-black text-xs font-extrabold hover:shadow-[0_0_30px_rgba(255,255,255,1)] transition-shadow"
                    >
                      Pick the package <ArrowRightIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-[#fff] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">{deal.title}</p>
                </div>
              </div>

              {/* Promo-stripe band, not flush with the card edges — the white
                  content panel below sits padded inside it, rather than the
                  white filling the whole width/corners like a plain document. */}
              <div className="yp-promo-stripes px-3 pt-2 pb-2">
                <div className="rounded-2xl bg-[#fff] px-3 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                  <div className="flex items-center justify-center flex-wrap gap-2 mb-2">
                    {savings > 0 && (
                      <span className="text-[11px] text-black/40 line-through">{originalPrice.toLocaleString()} RWF</span>
                    )}
                    <span className="text-xs text-black">
                      Only on <span className="text-sm font-extrabold">{deal.totalPrice.toLocaleString()} RWF</span>
                    </span>
                    {savings > 0 && (
                      <span className="text-[10px] font-extrabold text-[#fff] bg-coral px-2 py-0.5 rounded-full">
                        Save {savings.toLocaleString()} RWF
                      </span>
                    )}
                  </div>
                  <PlatformCarousel items={deal.items} creators={creators} websites={websites} />
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
