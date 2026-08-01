'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlobeAltIcon, FilmIcon, PhotoIcon, PlayCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import { fetchDashboardAds, type OwnWebsite, type MyAd, type YoutubeChannel } from '@/app/_lib/my-ads';
import SidebarToggleIcon from './SidebarToggleIcon';

// Choosing "Website" or "YouTube channel" routes to the same analytics tab
// that already handles both viewing what's connected and adding a new one,
// so the modal is just a fork in the road, not a duplicate add-flow.
function PlatformPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href, { scroll: false });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-surface-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-white mb-1">Continue with</h3>
        <p className="text-xs text-muted mb-4">Pick a platform to view or connect.</p>
        <div className="space-y-2">
          <button
            onClick={() => go('/?panel=websites')}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:border-coral/40 transition-colors text-left"
          >
            <GlobeAltIcon className="w-5 h-5 text-coral shrink-0" />
            <span className="text-sm font-semibold text-white">Website</span>
          </button>
          <button
            onClick={() => go('/?panel=youtube')}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:border-coral/40 transition-colors text-left"
          >
            <PlayCircleIcon className="w-5 h-5 text-coral shrink-0" />
            <span className="text-sm font-semibold text-white">YouTube channel</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// A handful of big, slightly-tilted polaroid-style cards fanned out inside a
// dark tray, reads as "a stack of your ad creatives" at a glance rather than
// a plain list.
const TILT = ['rotate-[-7deg] -translate-y-1', 'rotate-[4deg] translate-y-1.5', 'rotate-[-3deg] -translate-y-0.5', 'rotate-[6deg] translate-y-1'];

function AdStack({ ads }: { ads: MyAd[] }) {
  const shown = ads.slice(0, 4);
  return (
    <div className="relative h-40 mb-1">
      {shown.map((ad, i) => (
        <div
          key={ad.id}
          className={`yp-float absolute top-2 w-32 h-32 rounded-xl border-[3px] border-neutral-950 bg-neutral-800 shadow-xl overflow-hidden ${TILT[i % TILT.length]}`}
          style={{ left: `${i * 36}px`, zIndex: shown.length - i, animationDelay: `${i * 0.4}s` }}
        >
          {ad.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-800">
              {ad.kind === 'youtube' ? <FilmIcon className="w-8 h-8 text-neutral-600" /> : <GlobeAltIcon className="w-8 h-8 text-neutral-600" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MyAdsBox({ ads, loading, collapsed }: { ads: MyAd[]; loading: boolean; collapsed: boolean }) {
  const router = useRouter();

  if (collapsed) {
    return (
      <div className="group/box relative">
        <button
          onClick={() => router.push('/?panel=ads', { scroll: false })}
          className="w-full flex items-center justify-center p-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors"
        >
          <PhotoIcon className="w-5 h-5 text-white" />
        </button>
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-surface-3 text-white border border-border text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover/box:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
          Your ads
        </div>
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push('/?panel=ads', { scroll: false })}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push('/?panel=ads', { scroll: false }); }}
      className="cursor-pointer rounded-2xl border border-border bg-surface-2 p-5 transition-colors hover:bg-surface-3"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Your ads</h3>
        <Link
          href="/?panel=advertise"
          scroll={false}
          onClick={(e) => e.stopPropagation()}
          title="Add ad: pick a website or YouTube channel"
          className="flex items-center justify-center w-6 h-6 rounded-full bg-background text-white hover:bg-coral transition-colors shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-surface-3 animate-pulse" />
      ) : ads.length > 0 ? (
        <>
          <AdStack ads={ads} />
          <p className="text-base text-white mt-3 font-semibold">{ads.length} ad{ads.length === 1 ? '' : 's'} running</p>
        </>
      ) : (
        <div className="h-28 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center px-2">
          <PhotoIcon className="w-6 h-6 text-muted mb-1" />
          <p className="text-xs text-muted">No ads running yet</p>
        </div>
      )}
    </div>
  );
}

type PlatformItem =
  | { key: string; kind: 'website'; label: string; avatar: string | null }
  | { key: string; kind: 'youtube'; label: string; avatar: string | null };

function PlatformsBox({
  websites,
  channels,
  loading,
  collapsed,
  onOpenPicker,
}: {
  websites: OwnWebsite[];
  channels: YoutubeChannel[];
  loading: boolean;
  collapsed: boolean;
  onOpenPicker: () => void;
}) {
  const total = websites.length + channels.length;
  const items: PlatformItem[] = [
    ...websites.map((w): PlatformItem => ({ key: `w-${w.id}`, kind: 'website', label: w.websiteName, avatar: w.imageUrl })),
    ...channels.map((c): PlatformItem => ({ key: `c-${c.username}`, kind: 'youtube', label: `@${c.username}`, avatar: c.avatar })),
  ].slice(0, 3);

  if (collapsed) {
    return (
      <div className="group/box relative">
        <button
          onClick={onOpenPicker}
          className="w-full flex items-center justify-center p-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors"
        >
          <GlobeAltIcon className="w-5 h-5 text-white" />
        </button>
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-surface-3 text-white border border-border text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover/box:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
          Your platforms
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenPicker}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpenPicker(); }}
      className="cursor-pointer rounded-2xl border border-border bg-surface-2 p-4 transition-colors hover:bg-surface-3"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Your platforms</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
          title="Add a website or YouTube channel"
          className="flex items-center justify-center w-5 h-5 rounded-full bg-background text-white hover:bg-coral transition-colors shrink-0"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="h-16 rounded-lg bg-surface-3 animate-pulse" />
      ) : total === 0 ? (
        <p className="text-sm text-subtle">Connect a website or YouTube channel</p>
      ) : (
        <>
          <p className="text-sm text-white mb-2">
            {websites.length > 0 && `${websites.length} website${websites.length === 1 ? '' : 's'}`}
            {websites.length > 0 && channels.length > 0 && ' · '}
            {channels.length > 0 && `${channels.length} channel${channels.length === 1 ? '' : 's'}`}
          </p>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-sm text-subtle truncate">
                {item.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.avatar} alt="" className={`w-5 h-5 object-cover shrink-0 ${item.kind === 'youtube' ? 'rounded-full' : 'rounded'}`} />
                ) : item.kind === 'youtube' ? (
                  <PlayCircleIcon className="w-4 h-4 shrink-0" />
                ) : (
                  <GlobeAltIcon className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function RightRail() {
  const searchParams = useSearchParams();
  const [websites, setWebsites]             = useState<OwnWebsite[]>([]);
  const [myAds, setMyAds]                   = useState<MyAd[]>([]);
  const [youtubeChannels, setYoutubeChannels] = useState<YoutubeChannel[]>([]);
  const [loading, setLoading]               = useState(true);
  const [collapsed, setCollapsed]           = useState(false);
  const [pickerOpen, setPickerOpen]         = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardAds()
      .then(({ websites: ownWebsites, ads, youtubeChannels: channels }) => {
        if (cancelled) return;
        setWebsites(ownWebsites);
        setMyAds(ads);
        setYoutubeChannels(channels);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // A website's expanded detail view (Ad Spaces, Integration Codes, ...)
  // wants the full width, not a third of it eaten by this sidebar, so it
  // hides itself while one is open (see WebsitesList's expandSite).
  if (searchParams.get('panel') === 'websites' && searchParams.get('websiteId')) {
    return null;
  }

  return (
    <aside
      className={`shrink-0 self-start sticky top-4 py-4 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16 pr-2 pl-2' : 'w-72 pr-4 pl-2'
      }`}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={`mb-4 p-1.5 rounded-lg hover:bg-surface-3 text-white transition-colors ${collapsed ? 'mx-auto flex' : 'ml-auto flex'}`}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <SidebarToggleIcon className="w-5 h-5" />
      </button>

      <div className="space-y-4">
        <PlatformsBox
          websites={websites}
          channels={youtubeChannels}
          loading={loading}
          collapsed={collapsed}
          onOpenPicker={() => setPickerOpen(true)}
        />

        <MyAdsBox ads={myAds} loading={loading} collapsed={collapsed} />
      </div>

      <PlatformPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </aside>
  );
}
