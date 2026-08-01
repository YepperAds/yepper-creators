'use client';

import { useState } from 'react';
import { FireIcon } from '@heroicons/react/24/solid';
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
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Platforms</p>
              <DashboardFeed websites={displayWebsites} />
            </div>
          </>
        ) : tab === 'deals' ? (
          hotDeals.length > 0 ? (
            <HotDealsSection
              deals={hotDeals}
              initialDealId={dealId}
              websites={displayWebsites}
              creators={displayCreators}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-6 py-16">
              <FireIcon className="w-10 h-10 text-(--color-coral) mb-3" />
              <h1 className="text-xl font-bold text-(--color-white)">No Hot Deals right now</h1>
              <p className="text-sm text-(--color-muted) mt-1.5 max-w-sm">
                Admin-curated bundles of YouTube slots and website ad spaces show up here, with a fixed package price, as soon as one goes live.
              </p>
            </div>
          )
        ) : (
          <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Platforms</p>
            <DashboardFeed websites={displayWebsites} />
          </div>
        )}
      </div>
    </div>
  );
}
