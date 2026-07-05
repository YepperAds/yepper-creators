'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import DashboardFeed from './DashboardFeed';
import AdvertiseBrowser from './AdvertiseBrowser';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import AddWebsiteForm from '@/app/(adsense)/ad-promoter/pages/add-website/AddWebsiteForm';
import AnalyticsPage from '@/app/(advertiser)/analytics/page';
import WalletPage from '@/app/(advertiser)/wallet/page';
import ProfilePage from '@/app/(advertiser)/profile/page';
import NotificationsPage from '@/app/(advertiser)/notifications/page';
import ConnectAccountsPage from '@/app/(advertiser)/connect-accounts/page';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

// Solid pill, not just bare text on the mesh backdrop — the panels using
// this (websites, wallet, analytics, etc.) render directly on `yp-mesh`
// with no card behind them, so `text-subtle` alone has poor contrast
// against the vivid light-mode gradient.
function BackToFeed({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-white bg-surface-1 rounded-full px-3 py-1.5 border border-border transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" /> Back to feed
    </button>
  );
}

// Every panel that renders in the center column shares this exact card
// treatment (width, margins, padding) with the default feed's "Contents on
// Yepper" card below, so no panel ever looks narrower/smaller than another.
const PANEL_CARD = 'rounded-3xl border border-border/40 bg-surface-1 dark:bg-surface-1/25 backdrop-blur-2xl p-4 sm:p-6';

// The `useSearchParams()` boundary — this is the only part of the dashboard
// that needs to be wrapped in <Suspense> by the parent. `panel` drives which
// content shows in the center column; switching panels never leaves `/`.
export default function CenterPanel({
  websites,
  creators,
  hotDeals,
}: {
  websites: PublicWebsite[];
  creators: PublicCreator[];
  hotDeals: HotDeal[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get('panel');
  const dealId = searchParams.get('dealId') ?? undefined;

  const backToFeed = () => router.replace('/', { scroll: false });

  let content: React.ReactNode;
  if (panel === 'add-website') {
    content = (
      <AddWebsiteForm
        embedded
        onCreated={(websiteId: string) => router.replace(`/?panel=analytics&websiteId=${websiteId}`, { scroll: false })}
        onCancel={backToFeed}
      />
    );
  } else if (panel === 'analytics') {
    content = <div><BackToFeed onClick={backToFeed} /><div className={PANEL_CARD}><AnalyticsPage /></div></div>;
  } else if (panel === 'wallet') {
    content = <div><BackToFeed onClick={backToFeed} /><div className={PANEL_CARD}><WalletPage /></div></div>;
  } else if (panel === 'profile') {
    content = <div><BackToFeed onClick={backToFeed} /><div className={PANEL_CARD}><ProfilePage /></div></div>;
  } else if (panel === 'notifications') {
    content = <div><BackToFeed onClick={backToFeed} /><div className={PANEL_CARD}><NotificationsPage /></div></div>;
  } else if (panel === 'connect-accounts') {
    content = <div><BackToFeed onClick={backToFeed} /><div className={PANEL_CARD}><ConnectAccountsPage /></div></div>;
  } else if (panel === 'advertise') {
    content = (
      <div>
        <BackToFeed onClick={backToFeed} />
        <AdvertiseBrowser websites={websites} creators={creators} hotDeals={hotDeals} initialDealId={dealId} />
      </div>
    );
  } else {
    content = (
      <div>
        <HotDealsSection
          deals={hotDeals}
          initialDealId={dealId}
          websites={websites.length > 0 ? websites : MOCK_WEBSITES}
          creators={creators.length > 0 ? creators : MOCK_CREATORS}
        />
        <div className="rounded-3xl border border-border/40 bg-surface-1 dark:bg-surface-1/25 backdrop-blur-2xl p-4 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Contents on Yepper</p>
          <DashboardFeed
            websites={websites.length > 0 ? websites : MOCK_WEBSITES}
          />
        </div>
      </div>
    );
  }

  return content;
}
