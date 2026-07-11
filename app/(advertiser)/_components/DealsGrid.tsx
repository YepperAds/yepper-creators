'use client';

import { FireIcon } from '@heroicons/react/24/solid';
import type { HotDeal, PublicWebsite, PublicCreator } from '@/app/_lib/public-home';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import PageHeader from '@/app/_components/dashboard/PageHeader';

// Same rich spotlight card as the home feed's Hot Deals tab (HotDealsSection)
// — this panel used to have its own plainer card design, which meant a deal
// looked different depending on which route you found it through.
export default function DealsGrid({
  deals,
  websites,
  creators,
  onBack,
}: {
  deals: HotDeal[];
  websites: PublicWebsite[];
  creators: PublicCreator[];
  onBack?: () => void;
}) {
  if (deals.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <PageHeader title="Hot Deals" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <FireIcon className="w-10 h-10 text-(--color-coral) mb-3" />
          <h1 className="text-xl font-bold text-(--color-white)">No Hot Deals right now</h1>
          <p className="text-sm text-(--color-muted) mt-1.5 max-w-sm">
            Admin-curated bundles of YouTube slots and website ad spaces show up here, with a fixed package price, as soon as one goes live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader title="Curated Media Bundles & Deals" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6">
        <HotDealsSection deals={deals} websites={websites} creators={creators} />
      </div>
    </div>
  );
}
