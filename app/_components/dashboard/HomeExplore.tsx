'use client';

import { useState } from 'react';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import DashboardFeed from './DashboardFeed';
import PageHeader from './PageHeader';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

type Tab = 'all' | 'deals' | 'websites';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'deals',    label: 'Hot Deals' },
  { id: 'websites', label: 'Websites' },
];

function TabPill({ active, onClick, children }: { active: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        active
          ? 'bg-surface-3 text-white'
          : onClick
          ? 'text-white opacity-70 hover:opacity-100 hover:bg-surface-2'
          : 'text-muted cursor-default'
      }`}
    >
      {children}
    </button>
  );
}

// "More" is a real tab visually (matches the reference layout) but has
// nothing behind it yet — a hover tooltip says so instead of the tab
// silently doing nothing.
function MoreTab() {
  return (
    <div className="group/more relative">
      <TabPill active={false}>More</TabPill>
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 bg-surface-3 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover/more:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
        More coming soon
      </div>
    </div>
  );
}

export default function HomeExplore({
  websites,
  creators,
  hotDeals,
  dealId,
}: {
  websites: PublicWebsite[];
  creators: PublicCreator[];
  hotDeals: HotDeal[];
  dealId?: string;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const displayWebsites = websites.length > 0 ? websites : MOCK_WEBSITES;
  const displayCreators = creators.length > 0 ? creators : MOCK_CREATORS;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader title="Explore Hot Deals, Websites & Broadcast Media" />

      <div className="shrink-0 flex items-center justify-center gap-2 pb-4 pt-2">
        {TABS.map((t) => (
          <TabPill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabPill>
        ))}
        <MoreTab />
      </div>

      {/* px-2: the hot-deal card's pulsing glow (box-shadow, see .hotdeal-glow
          in globals.css) needs a few pixels of clearance before it hits
          <main>'s own overflow-hidden edge (DashboardHome.tsx), otherwise the
          glow gets visibly clipped on whichever side sits flush against it. */}
      <div key={tab} className="flex-1 overflow-y-auto px-2">
        {tab === 'all' ? (
          <>
            <HotDealsSection
              deals={hotDeals}
              initialDealId={dealId}
              websites={displayWebsites}
              creators={displayCreators}
            />
            <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Contents on Yepper</p>
              <DashboardFeed websites={displayWebsites} />
            </div>
          </>
        ) : tab === 'deals' ? (
          <HotDealsSection
            deals={hotDeals}
            initialDealId={dealId}
            websites={displayWebsites}
            creators={displayCreators}
          />
        ) : (
          <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Contents on Yepper</p>
            <DashboardFeed websites={displayWebsites} />
          </div>
        )}
      </div>
    </div>
  );
}
