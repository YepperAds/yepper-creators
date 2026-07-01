'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FireIcon } from '@heroicons/react/24/solid';
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
          return (
            <div key={deal.id} className="hotdeal-glow relative overflow-hidden rounded-2xl max-w-2xl">
              <div className="relative h-24 sm:h-28 bg-[#111318]">
                {!category.isIcon && (
                  <>
                    <Image src={category.image} alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/55 to-black/70" />
                  </>
                )}

                <div className="relative z-10 h-full flex flex-col justify-between p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#facc15] [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                      {category.label}
                    </p>
                    <button
                      onClick={() => pickDeal(deal)}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-white text-black text-[11px] font-extrabold shadow-[0_0_14px_rgba(255,255,255,0.55)] hover:shadow-[0_0_20px_rgba(255,255,255,0.75)] transition-shadow"
                    >
                      Pick the package
                    </button>
                  </div>
                  <p className="text-xs font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">{deal.title}</p>
                </div>
              </div>

              <div className="bg-white px-3 py-3">
                <p className="text-center text-xs text-black mb-2.5">
                  Only on <span className="text-sm font-extrabold">{deal.totalPrice.toLocaleString()} RWF</span>
                </p>
                <PlatformCarousel items={deal.items} creators={creators} websites={websites} />
              </div>
            </div>
          );
        })}
      </div>

      <HotDealPurchaseModal deal={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}
