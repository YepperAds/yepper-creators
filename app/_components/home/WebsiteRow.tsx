'use client';

import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import CategoryCard from '@/app/_components/shared/CategoryCard';
import type { PublicWebsite } from '@/app/_lib/public-home';

// Compact horizontal-scroll card — a lighter-weight sibling of the
// dashboard's HomeFeed/WebsiteCard (that one's a wide row, built for a
// vertical feed; this one's a fixed-width tile, built for a scroll row).
// Marketing-only, so fixed literal colors — see HotDealsSection's variant
// prop for why.

function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

function startCollaborate(id: string) {
  const from = `/?panel=advertise&websiteId=${encodeURIComponent(id)}`;
  window.location.href = `/login?from=${encodeURIComponent(from)}`;
}

function WebsiteTile({ website }: { website: PublicWebsite }) {
  return (
    <button
      onClick={() => startCollaborate(website.id)}
      className="group w-[320px] shrink-0 text-left rounded-3xl bg-white overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.16)] hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative aspect-[4/3] bg-[color:var(--mkt-surface)]">
        {website.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={website.imageUrl} alt={website.websiteName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[color:var(--mkt-ink-muted)] text-xs">No preview</div>
        )}
        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[color:var(--mkt-ink)] shadow-sm">
          <ShieldCheckIcon className="w-3.5 h-3.5 text-blue" /> Verified
        </span>
      </div>
      <div className="p-5">
        <p className="text-base font-bold text-[color:var(--mkt-ink)] font-(--font-display) truncate">{website.websiteName}</p>
        <p className="text-xs text-[color:var(--mkt-ink-muted)] mt-0.5 truncate">{domainOf(website.websiteLink)}</p>
        {website.businessCategories?.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {website.businessCategories.slice(0, 2).map((c) => (
              <CategoryCard key={c} id={c} size="badge" />
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-[color:var(--mkt-border)] flex items-center justify-between">
          <span className="text-sm font-semibold text-coral">Advertise here</span>
          <ArrowRightIcon className="w-4 h-4 text-coral group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
}

export default function WebsiteRow({ websites }: { websites: PublicWebsite[] }) {
  if (websites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--mkt-border)] py-10 text-center text-[color:var(--mkt-ink-muted)] text-sm">
        No listings yet.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto yp-scroll-row pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
      {websites.map((website) => <WebsiteTile key={website.id} website={website} />)}
    </div>
  );
}
