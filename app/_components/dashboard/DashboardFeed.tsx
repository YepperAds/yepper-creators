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
    <div className="rounded-2xl bg-[#0b0b0c] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-[#fff]">Website</p>
        <button
          onClick={() => onOpen(website)}
          className="text-xs font-semibold text-[#fff] underline underline-offset-2 hover:text-coral transition-colors"
        >
          Advertise on {website.websiteName}
        </button>
      </div>

      <div className="flex gap-4">
        <button onClick={() => onOpen(website)} className="relative block w-32 sm:w-40 aspect-[4/3] shrink-0 text-left">
          <WebsiteLogoTile website={website} className="absolute inset-0" />
          <span className="absolute bottom-1.5 right-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">Choose ad space</span>
        </button>

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
    <div className="space-y-4">
      {websites.map((website) => (
        <WebsiteCard key={website.id} website={website} onOpen={openWebsite} />
      ))}
    </div>
  );
}
