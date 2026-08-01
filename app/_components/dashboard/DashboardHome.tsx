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
        <div key={i} className="h-24 rounded-2xl bg-surface-2 animate-pulse" />
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
    <div className="h-screen flex bg-background font-(--font-inter)">
      <Suspense fallback={<div className="w-64 shrink-0 h-screen bg-background" />}>
        <LeftRail />
      </Suspense>

      {/* Fixed-height shell: only the page rendered inside <main> scrolls
          (each page manages its own header/tabs/scroll-body, see
          PageHeader.tsx), so the sidebar, top header, and right rail never
          move when the page's content does. */}
      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 min-h-0 flex max-w-[1400px] w-full mx-auto">
          <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col px-4 sm:px-6">
            <Suspense fallback={<CenterPanelSkeleton />}>
              <CenterPanel websites={websites} creators={creators} hotDeals={hotDeals} />
            </Suspense>
          </main>
          <Suspense fallback={<div className="w-72 shrink-0" />}>
            <RightRail />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
