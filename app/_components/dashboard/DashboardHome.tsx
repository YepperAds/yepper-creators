import { Suspense } from 'react';
import Header from './Header';
import LeftRail from './LeftRail';
import RightRail from './RightRail';
import CenterPanel from './CenterPanel';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

function CenterPanelSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-background animate-pulse" />
      ))}
    </div>
  );
}

export default function DashboardHome({
  websites,
  creators,
  hotDeals,
}: {
  websites: PublicWebsite[];
  creators: PublicCreator[];
  hotDeals: HotDeal[];
}) {
  return (
    <div className="yp-mesh min-h-screen font-(--font-inter)">
      <Header />
      <div className="max-w-[1600px] mx-auto flex">
        <Suspense fallback={<div className="w-64 shrink-0" />}>
          <LeftRail />
        </Suspense>
        <main className="flex-1 min-w-0 py-4 px-2">
          <Suspense fallback={<CenterPanelSkeleton />}>
            <CenterPanel websites={websites} creators={creators} hotDeals={hotDeals} />
          </Suspense>
        </main>
        <RightRail />
      </div>
    </div>
  );
}
