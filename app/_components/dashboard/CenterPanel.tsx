'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import AdvertiseBrowser from './AdvertiseBrowser';
import HomeExplore from './HomeExplore';
import AddWebsiteForm from '@/app/(adsense)/ad-promoter/pages/add-website/AddWebsiteForm';
import AnalyticsPage from '@/app/(advertiser)/analytics/page';
import WalletPage from '@/app/(advertiser)/wallet/page';
import ProfilePage from '@/app/(advertiser)/profile/page';
import NotificationsPage from '@/app/(advertiser)/notifications/page';
import ConnectAccountsPage from '@/app/(advertiser)/connect-accounts/page';
import SupportPage from '@/app/(advertiser)/support/page';
import DealsGrid from '@/app/(advertiser)/_components/DealsGrid';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

// Solid pill, not just bare text on the mesh backdrop — the panels using
// this (websites, wallet, analytics, etc.) render directly on `yp-mesh`
// with no card behind them, so `text-subtle` alone has poor contrast
// against the vivid light-mode gradient.
function BackToFeed({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-white bg-surface-2 rounded-full px-3 py-1.5 border border-border transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" /> Back to feed
    </button>
  );
}

// Every panel that renders in the center column shares this exact card
// treatment (width, margins, padding) with the default feed's "Contents on
// Yepper" card below, so no panel ever looks narrower/smaller than another.
const PANEL_CARD = 'rounded-3xl border border-border bg-surface-2 p-4 sm:p-6';

// These older panels don't manage their own header/scroll region (see
// PageHeader.tsx for the ones that do — HomeExplore, DealsGrid,
// NotificationsPage) — <main> itself no longer scrolls (each page owns its
// scroll now), so they need this wrapper to stay reachable at all.
function LegacyPanel({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto py-4">
      <BackToFeed onClick={onBack} />
      <div className={PANEL_CARD}>{children}</div>
    </div>
  );
}

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
      <div className="h-full overflow-y-auto py-4">
        <AddWebsiteForm
          embedded
          onCreated={(websiteId: string) => router.replace(`/?panel=analytics&websiteId=${websiteId}`, { scroll: false })}
          onCancel={backToFeed}
        />
      </div>
    );
  } else if (panel === 'analytics') {
    content = <LegacyPanel onBack={backToFeed}><AnalyticsPage /></LegacyPanel>;
  } else if (panel === 'wallet') {
    content = <LegacyPanel onBack={backToFeed}><WalletPage /></LegacyPanel>;
  } else if (panel === 'profile') {
    content = <LegacyPanel onBack={backToFeed}><ProfilePage /></LegacyPanel>;
  } else if (panel === 'notifications') {
    content = <NotificationsPage onBack={backToFeed} />;
  } else if (panel === 'connect-accounts') {
    content = <LegacyPanel onBack={backToFeed}><ConnectAccountsPage /></LegacyPanel>;
  } else if (panel === 'support') {
    content = <LegacyPanel onBack={backToFeed}><SupportPage /></LegacyPanel>;
  } else if (panel === 'deals') {
    content = <DealsGrid deals={hotDeals} onBack={backToFeed} />;
  } else if (panel === 'advertise') {
    content = (
      <div className="h-full overflow-y-auto py-4">
        <AdvertiseBrowser websites={websites} creators={creators} hotDeals={hotDeals} initialDealId={dealId} onBackToFeed={backToFeed} />
      </div>
    );
  } else {
    content = <HomeExplore websites={websites} creators={creators} hotDeals={hotDeals} dealId={dealId} />;
  }

  return content;
}
