'use client';

import { useRouter } from 'next/navigation';
import WebsiteLogoTile from './WebsiteLogoTile';
import CategoryCard from '@/app/_components/shared/CategoryCard';
import type { PublicWebsite } from '@/app/_lib/public-home';

function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

// Clicking through takes the advertiser straight into the ad-space chooser
// for this exact website (AdvertiseBrowser reads `websiteId` off the URL and
// auto-opens it) — not out to the site's real URL, which just abandoned the
// flow instead of letting them pick a space.
function WebsiteCard({ website, onOpen }: { website: PublicWebsite; onOpen: (website: PublicWebsite) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4 sm:p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm font-bold text-white">Website</p>
      </div>

      <button onClick={() => onOpen(website)} className="relative block w-full aspect-[4/3] shrink-0 text-left mb-4">
        <WebsiteLogoTile website={website} className="absolute inset-0" />
        <span className="absolute bottom-1.5 right-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">Choose ad space</span>
      </button>

      <div className="flex flex-col justify-between min-w-0 flex-1">
        <div>
          <p className="text-sm font-bold text-white font-(--font-display)">{website.websiteName}</p>
          {website.businessCategories?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {website.businessCategories.map((c) => (
                <CategoryCard key={c} id={c} size="badge" />
              ))}
            </div>
          )}
          <p className="text-xs text-muted mt-1.5">{domainOf(website.websiteLink)}</p>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {websites.map((website) => (
        <WebsiteCard key={website.id} website={website} onOpen={openWebsite} />
      ))}
    </div>
  );
}
