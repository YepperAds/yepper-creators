'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import TierBadge from '@/app/_components/shared/TierBadge';
import type { PublicWebsite, PublicCreator } from '@/app/_lib/public-home';
import PlatformCreatorCard from './PlatformCreatorCard';
import WebsiteAdPreview from './WebsiteAdPreview';

// Clicking through takes the advertiser straight into the ad-space chooser
// for this exact website (AdvertiseBrowser reads `websiteId` off the URL and
// auto-opens it), not out to the site's real URL, which just abandoned the
// flow instead of letting them pick a space.
function WebsiteCard({ website, onOpen }: { website: PublicWebsite; onOpen: (website: PublicWebsite) => void }) {
  // The catch-all "any category" placeholder isn't a real category, so it's
  // filtered out here: a badge that just says "Any category" tells an
  // advertiser nothing about the site.
  const realCategories = (website.businessCategories ?? []).filter((c) => c !== 'any');
  const [logoBroken, setLogoBroken] = useState(false);
  let domain = website.websiteLink;
  try {
    domain = new URL(website.websiteLink).hostname.replace(/^www\./, '');
  } catch {
    domain = website.websiteLink.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-surface-2 p-4 transition-colors hover:border-white/20 sm:p-5">
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white text-slate-500">
          {website.imageUrl && !logoBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt="" className="h-full w-full object-contain" onError={() => setLogoBroken(true)} />
          ) : <GlobeAltIcon className="h-6 w-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-white">{website.websiteName}</span>
          <span className="mt-0.5 block truncate text-xs text-white/55">{domain}</span>
        </span>
        <span className="shrink-0" title={`${website.trafficTier} tier`}><TierBadge tier={website.trafficTier} className="h-5 w-5" /></span>
      </div>

      <WebsiteAdPreview website={website} />

      <div className="mb-4 min-h-16 flex-1 border-t border-white/[0.08] pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">Ad categories</p>
        {realCategories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {realCategories.slice(0, 3).map((category) => <span key={category} className="rounded-md bg-white/[0.07] px-2 py-1 text-[11px] font-medium text-white/75">{category}</span>)}
            {realCategories.length > 3 && <span className="rounded-md bg-white/[0.07] px-2 py-1 text-[11px] font-medium text-white/55">+{realCategories.length - 3}</span>}
          </div>
        ) : <p className="text-xs text-white/50">Categories not listed</p>}
      </div>

      <button onClick={() => onOpen(website)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral">
        <span>View ad spaces</span><ArrowRightIcon className="h-4 w-4 shrink-0" />
      </button>
    </article>
  );
}

export default function DashboardFeed({
  websites,
  creators = [],
  onCreatorClick,
}: {
  websites: PublicWebsite[];
  creators?: PublicCreator[];
  onCreatorClick?: (creator: PublicCreator) => void;
}) {
  const router = useRouter();
  const openWebsite = (website: PublicWebsite) => router.push(`/?panel=advertise&websiteId=${website.id}`, { scroll: false });
  const openCreator = (creator: PublicCreator) => {
    if (onCreatorClick) onCreatorClick(creator);
    else router.push(`/?panel=advertise&creatorId=${creator.id}`, { scroll: false });
  };

  if (websites.length === 0 && creators.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted text-sm">
        No listings yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
      {creators.map((creator) => (
        <PlatformCreatorCard
          key={`creator-${creator.provider ?? 'youtube'}-${creator.id}`}
          creator={creator}
          onClick={() => openCreator(creator)}
          className="w-full"
          actionText={`Choose a ${creator.provider === 'tiktok' ? 'TikTok' : 'YouTube'} ad space`}
        />
      ))}
      {websites.map((website) => (
        <WebsiteCard key={website.id} website={website} onOpen={openWebsite} />
      ))}
    </div>
  );
}



// 'use client';

// import { useRouter } from 'next/navigation';
// import WebsiteLogoTile from './WebsiteLogoTile';
// import CategoryCard from '@/app/_components/shared/CategoryCard';
// import type { PublicWebsite } from '@/app/_lib/public-home';

// // Clicking through takes the advertiser straight into the ad-space chooser
// // for this exact website (AdvertiseBrowser reads `websiteId` off the URL and
// // auto-opens it), not out to the site's real URL, which just abandoned the
// // flow instead of letting them pick a space.
// function WebsiteCard({ website, onOpen }: { website: PublicWebsite; onOpen: (website: PublicWebsite) => void }) {
//   // The catch-all "any category" placeholder isn't a real category, so it's
//   // filtered out here: a badge that just says "Any category" tells an
//   // advertiser nothing about the site.
//   const realCategories = (website.businessCategories ?? []).filter((c) => c !== 'any');
//   return (
//     <div className="rounded-2xl border border-border bg-surface-2 p-4 sm:p-5 flex flex-col h-full">
//       <div className="flex items-center justify-between mb-4 gap-2">
//         <p className="text-sm font-bold text-white">Website</p>
//       </div>

//       <button onClick={() => onOpen(website)} className="relative block w-full aspect-[4/3] shrink-0 text-left mb-4 rounded-lg overflow-hidden border border-border">
//         <WebsiteLogoTile website={website} className="absolute inset-0" />
//         <span className="absolute bottom-1.5 right-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">Choose ad space</span>
//       </button>

//       <div className="flex flex-col justify-between min-w-0 flex-1">
//         <div>
//           {/* No name here: it's already shown once, beside the logo inside
//               WebsiteLogoTile's own header bar, above. */}
//           {realCategories.length > 0 && (
//             <div className="mt-1.5 flex flex-wrap gap-1">
//               {realCategories.map((c) => (
//                 <CategoryCard key={c} id={c} size="badge" />
//               ))}
//             </div>
//           )}
//         </div>

//         <button
//           onClick={() => onOpen(website)}
//           className="mt-3 text-xs font-semibold text-subtle underline underline-offset-2 hover:text-coral-text transition-colors text-left"
//         >
//           Advertise on {website.websiteName}
//         </button>
//       </div>
//     </div>
//   );
// }

// export default function DashboardFeed({ websites }: { websites: PublicWebsite[] }) {
//   const router = useRouter();
//   const openWebsite = (website: PublicWebsite) => router.push(`/?panel=advertise&websiteId=${website.id}`, { scroll: false });

//   if (websites.length === 0) {
//     return (
//       <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted text-sm">
//         No listings yet.
//       </div>
//     );
//   }

//   return (
//     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//       {websites.map((website) => (
//         <WebsiteCard key={website.id} website={website} onOpen={openWebsite} />
//       ))}
//     </div>
//   );
// }
