'use client';

import CategoryCard from '@/app/_components/shared/CategoryCard';
import TierBadge from '@/app/_components/shared/TierBadge';
import type { PublicWebsite } from '@/app/_lib/public-home';

// Logged-out visitors can't collaborate yet. Send them to log in, then land
// straight back on the dashboard's advertise panel with this exact website
// already open, instead of dropping them on a blank feed.
function startCollaborate(param: 'websiteId', id: string) {
  const from = `/?panel=advertise&${param}=${encodeURIComponent(id)}`;
  window.location.href = `/login?from=${encodeURIComponent(from)}`;
}

function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

function WebsiteCard({ website }: { website: PublicWebsite }) {
  return (
    <div className="rounded-2xl bg-[#0b0b0c] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[#fff]">Website</p>
          <TierBadge tier={website.trafficTier} />
        </div>
        <button
          onClick={() => startCollaborate('websiteId', website.id)}
          className="text-xs font-semibold text-[#fff] underline underline-offset-2 hover:text-coral transition-colors shrink-0"
        >
          Advertise on {website.websiteName}
        </button>
      </div>

      <div className="flex gap-4">
        <a
          href={website.websiteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-32 sm:w-40 aspect-[4/3] shrink-0 rounded-lg overflow-hidden bg-surface-3"
        >
          {website.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt={website.websiteName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">No preview</div>
          )}
          <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">View</span>
        </a>

        <div className="flex flex-col justify-between min-w-0">
          <div>
            <p className="text-sm font-bold text-[#fff] font-(--font-display)">{website.websiteName}</p>
            {website.businessCategories?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {website.businessCategories.map((c) => (
                  <CategoryCard key={c} id={c} size="badge" />
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-[#fff]/50">{domainOf(website.websiteLink)}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomeFeed({ websites }: { websites: PublicWebsite[] }) {
  if (websites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted text-sm">
        No listings yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {websites.map((website) => <WebsiteCard key={website.id} website={website} />)}
    </div>
  );
}
