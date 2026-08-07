'use client';

import { useState } from 'react';
import { GlobeAltIcon } from '@heroicons/react/24/solid';
import type { PublicWebsite } from '@/app/_lib/public-home';
import TierBadge from '@/app/_components/shared/TierBadge';

// A little browser window: a chrome bar up top carrying the real domain
// (address-bar position), sat above a neutral page body with the site's
// real logo + name in it.
function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

// Deliberately no rounded-*/border here. Callers own their own
// radius/clipping on whatever element bounds this tile (so a caller that
// nests it inside an already-rounded card never ends up with two
// mismatched radii fighting for the same corner).
export default function WebsiteLogoTile({ website, className }: { website: PublicWebsite; className?: string }) {
  // Stored imageUrl can point at a dead/wrong-content URL (the backend
  // re-verifies on its own now, see logoDetect.js, but that's async and
  // won't have caught up yet on this exact load) — fall back to the globe
  // icon instead of a broken image if it actually fails to load.
  const [logoBroken, setLogoBroken] = useState(false);
  const showLogo = !!website.imageUrl && !logoBroken;

  return (
    <div className={`flex flex-col overflow-hidden bg-[#fff] ${className ?? ''}`}>
      {/* Browser chrome: real domain in the address-bar position. The logo
          used to also sit here, favicon-size, but that just duplicated the
          much bigger one below and made the real logo look like an
          afterthought; one clear placement beats two small ones. */}
      <div className="h-9 shrink-0 flex items-center px-2 bg-[#f1f5f9] border-b border-black/10">
        <span className="flex-1 min-w-0 h-5 rounded-full bg-[#fff] ring-1 ring-black/10 flex items-center px-2.5">
          <span className="text-[11px] font-medium text-slate-500 truncate leading-none">{domainOf(website.websiteLink)}</span>
        </span>
      </div>

      {/* Page body: a little wireframe (nav + hero + content grid), not just
          a flat color block, so the tile reads as an actual page layout. */}
      <div className="relative flex-1 overflow-hidden bg-[#f8fafc]">
        {/* Mini nav bar: near-white grey (not the site's own brand color —
            the logo and name are legible on any site's actual colors this
            way, instead of fighting a per-site gradient for contrast). */}
        <div className="h-[26%] flex items-center gap-[6%] px-[10%] bg-[#F2F2F3] border-b border-black/5">
          <span className="flex items-center justify-center w-[16%] aspect-square rounded-full bg-[#fff] ring-2 ring-black/10 shrink-0 overflow-hidden">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={website.imageUrl!}
                alt=""
                className="w-full h-full object-contain"
                onError={() => setLogoBroken(true)}
              />
            ) : (
              <GlobeAltIcon className="w-2/3 h-2/3 text-slate-400" />
            )}
          </span>
          <span className="min-w-0 flex-1 text-[11px] font-bold text-black truncate">
            {website.websiteName}
          </span>
          <TierBadge tier={website.trafficTier} />
        </div>

        {/* Content skeleton, fixed (not %) heights: this wrapper's own
            height is auto (sized to content), so percentage heights on its
            children would resolve to nothing per the CSS spec. */}
        <div className="p-[10%] space-y-1.5">
          <div className="h-1.5 w-3/4 rounded-full bg-slate-300" />
          <div className="h-1 w-1/2 rounded-full bg-slate-200" />
          <div className="flex gap-[6%] pt-1.5">
            <div className="flex-1 aspect-square rounded-md bg-slate-200" />
            <div className="flex-1 aspect-square rounded-md bg-slate-200" />
            <div className="flex-1 aspect-square rounded-md bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
