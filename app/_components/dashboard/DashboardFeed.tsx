'use client';

import { useRouter } from 'next/navigation';
import WebsiteLogoTile from './WebsiteLogoTile';
import CategoryCard from '@/app/_components/shared/CategoryCard';
import type { PublicWebsite } from '@/app/_lib/public-home';

// Clicking through takes the advertiser straight into the ad-space chooser
// for this exact website (AdvertiseBrowser reads `websiteId` off the URL and
// auto-opens it), not out to the site's real URL, which just abandoned the
// flow instead of letting them pick a space.
function WebsiteCard({ website, onOpen }: { website: PublicWebsite; onOpen: (website: PublicWebsite) => void }) {
  // The catch-all "any category" placeholder isn't a real category, so it's
  // filtered out here: a badge that just says "Any category" tells an
  // advertiser nothing about the site.
  const realCategories = (website.businessCategories ?? []).filter((c) => c !== 'any');
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4 sm:p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm font-bold text-white">Website</p>
      </div>

      <button onClick={() => onOpen(website)} className="relative block w-full aspect-[4/3] shrink-0 text-left mb-4 rounded-lg overflow-hidden border border-border">
        <WebsiteLogoTile website={website} className="absolute inset-0" />
        <span className="absolute bottom-1.5 right-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">Choose ad space</span>
      </button>

      <div className="flex flex-col justify-between min-w-0 flex-1">
        <div>
          {/* Fixed white on purpose: stays light even in light mode instead
              of flipping to dark ink via the adaptive text-white token. */}
          <p className="text-sm font-bold text-[#fff] font-(--font-display)">{website.websiteName}</p>
          {realCategories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {realCategories.map((c) => (
                <CategoryCard key={c} id={c} size="badge" />
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onOpen(website)}
          className="mt-3 text-xs font-semibold text-subtle underline underline-offset-2 hover:text-coral-text transition-colors text-left"
        >
          Advertise on {website.websiteName}
        </button>
      </div>
    </div>
  );
}

export default function DashboardFeed({ websites }: { websites: PublicWebsite[] }) {
  const router = useRouter();
  const openWebsite = (website: PublicWebsite) => router.push(`/?panel=advertise&websiteId=${website.id}`, { scroll: false });

  if (websites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted text-sm">
        No listings yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {websites.map((website) => (
        <WebsiteCard key={website.id} website={website} onOpen={openWebsite} />
      ))}
    </div>
  );
}
