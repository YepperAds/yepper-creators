'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlobeAltIcon, FilmIcon, PhotoIcon, PlayCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import { fetchDashboardAds, type OwnWebsite, type MyAd, type YoutubeChannel } from '@/app/_lib/my-ads';

// The box body navigates to the "view all" panel on click; the "+" pill in
// the header navigates to the add flow instead. Both use next/link, but the
// outer wrapper is a plain div (not an <a>) so the inner Link never ends up
// nested inside an anchor — stopPropagation keeps its click from also
// triggering the outer navigation.
function Box({
  title,
  href,
  addHref,
  addLabel,
  children,
}: {
  title: string;
  href: string;
  addHref: string;
  addLabel: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href, { scroll: false })}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(href, { scroll: false }); }}
      className="cursor-pointer rounded-2xl border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
        <Link
          href={addHref}
          scroll={false}
          onClick={(e) => e.stopPropagation()}
          title={addLabel}
          className="flex items-center justify-center w-5 h-5 rounded-full bg-background text-white hover:bg-coral transition-colors shrink-0"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}

// A handful of big, slightly-tilted polaroid-style cards fanned out inside a
// dark tray — reads as "a stack of your ad creatives" at a glance rather than
// a plain list.
const TILT = ['rotate-[-7deg] -translate-y-1', 'rotate-[4deg] translate-y-1.5', 'rotate-[-3deg] -translate-y-0.5', 'rotate-[6deg] translate-y-1'];

function AdStack({ ads }: { ads: MyAd[] }) {
  const shown = ads.slice(0, 4);
  return (
    <div className="relative h-28 mb-1">
      {shown.map((ad, i) => (
        <div
          key={ad.id}
          className={`absolute top-2 w-20 h-20 rounded-xl border-[3px] border-neutral-950 bg-neutral-800 shadow-xl overflow-hidden ${TILT[i % TILT.length]}`}
          style={{ left: `${i * 30}px`, zIndex: shown.length - i }}
        >
          {ad.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-800">
              {ad.kind === 'youtube' ? <FilmIcon className="w-6 h-6 text-neutral-600" /> : <GlobeAltIcon className="w-6 h-6 text-neutral-600" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MyAdsBox({ ads, loading }: { ads: MyAd[]; loading: boolean }) {
  const router = useRouter();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push('/?panel=ad-posts', { scroll: false })}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push('/?panel=ad-posts', { scroll: false }); }}
      className="cursor-pointer rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:bg-neutral-800"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">My ads</h3>
        <Link
          href="/?panel=add-ad"
          scroll={false}
          onClick={(e) => e.stopPropagation()}
          title="Add ad"
          className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-800 text-white hover:bg-coral transition-colors shrink-0"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="h-28 rounded-xl bg-neutral-800 animate-pulse" />
      ) : ads.length > 0 ? (
        <>
          <AdStack ads={ads} />
          <p className="text-sm text-[#fff] mt-2">{ads.length} ad{ads.length === 1 ? '' : 's'} running</p>
        </>
      ) : (
        <div className="h-20 rounded-xl border border-dashed border-neutral-700 flex flex-col items-center justify-center text-center px-2">
          <PhotoIcon className="w-5 h-5 text-neutral-600 mb-1" />
          <p className="text-xs text-neutral-500">No ads running yet</p>
        </div>
      )}
    </div>
  );
}

function YoutubeChannelsBox({ channels, loading }: { channels: YoutubeChannel[]; loading: boolean }) {
  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <Box title="Your YouTube channels" href="/?panel=connect-accounts" addHref="/?panel=connect-accounts" addLabel="Connect YouTube channel">
      {loading ? (
        <div className="h-16 rounded-lg bg-background animate-pulse" />
      ) : channels.length > 0 ? (
        <>
          <p className="text-sm text-white mb-2">{channels.length} connected</p>
          <div className="space-y-2">
            {channels.slice(0, 3).map((c) => (
              <div key={c.username} className="flex items-center gap-2 text-sm text-subtle truncate">
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <PlayCircleIcon className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">@{c.username}</span>
                <span className="ml-auto shrink-0 text-xs text-muted">{formatCount(c.followers)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-subtle">Connect YouTube</p>
      )}
    </Box>
  );
}

export default function RightRail() {
  const [websites, setWebsites]             = useState<OwnWebsite[]>([]);
  const [myAds, setMyAds]                   = useState<MyAd[]>([]);
  const [youtubeChannels, setYoutubeChannels] = useState<YoutubeChannel[]>([]);
  const [loading, setLoading]               = useState(true);

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

  return (
    <aside className="w-72 shrink-0 self-start sticky top-4 space-y-4 p-4">
      <Box title="Your websites" href="/?panel=websites" addHref="/?panel=add-website" addLabel="Add website">
        {loading ? (
          <div className="h-16 rounded-lg bg-background animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-white mb-2">{websites.length} connected</p>
            <div className="space-y-2">
              {websites.slice(0, 3).map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm text-subtle truncate">
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.imageUrl} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                  ) : (
                    <GlobeAltIcon className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{w.websiteName}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Box>

      <YoutubeChannelsBox channels={youtubeChannels} loading={loading} />

      <MyAdsBox ads={myAds} loading={loading} />
    </aside>
  );
}
