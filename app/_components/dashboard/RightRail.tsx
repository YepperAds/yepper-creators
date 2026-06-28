'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobeAltIcon, FilmIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface OwnWebsite { id: string | number; websiteName: string; imageUrl: string | null }
interface OwnAdPost { id: number; title: string; thumbnail_url: string | null }
interface MyAd { id: string; image: string | null; title: string; kind: 'website' | 'youtube' }

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-3">{title}</h3>
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
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">My ads</h3>

      {loading ? (
        <div className="h-28 rounded-xl bg-neutral-800 animate-pulse" />
      ) : ads.length > 0 ? (
        <>
          <AdStack ads={ads} />
          <p className="text-sm text-[#fff] mt-2 mb-3">{ads.length} ad{ads.length === 1 ? '' : 's'} running</p>
        </>
      ) : (
        <div className="h-20 rounded-xl border border-dashed border-neutral-700 flex flex-col items-center justify-center text-center mb-3 px-2">
          <PhotoIcon className="w-5 h-5 text-neutral-600 mb-1" />
          <p className="text-xs text-neutral-500">No ads running yet</p>
        </div>
      )}

      <Link href="/?panel=ad-posts" scroll={false} className="text-xs font-medium text-neutral-400 hover:text-[#fff]">
        View all
      </Link>
    </div>
  );
}

export default function RightRail() {
  const [websites, setWebsites]   = useState<OwnWebsite[]>([]);
  const [myAds, setMyAds]         = useState<MyAd[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sessRes  = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
        const sessJson = await sessRes.json().catch(() => ({}));
        const userId   = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
        if (!userId || cancelled) return;

        const [wRes, aRes, activeRes] = await Promise.all([
          fetch(`/api/proxy/api/websites/${userId}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/social/ad-posts?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' }),
          fetch('/api/proxy/api/ad-categories/active-ads', { credentials: 'include', cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const wJson = await wRes.json().catch(() => ({}));
        const ownWebsites: OwnWebsite[] = Array.isArray(wJson) ? wJson : (wJson?.data ?? []);
        setWebsites(ownWebsites);

        const aJson = await aRes.json().catch(() => ({}));
        const adPosts: OwnAdPost[] = Array.isArray(aJson?.data) ? aJson.data : [];

        const ownWebsiteIds = new Set(ownWebsites.map((w) => String(w.id)));
        const activeJson = await activeRes.json().catch(() => ({}));
        const activeAds: Array<Record<string, unknown>> = Array.isArray(activeJson?.activeAds) ? activeJson.activeAds : [];
        const websiteAds: MyAd[] = activeAds
          .filter((ad) => Array.isArray(ad.websiteSelections) && (ad.websiteSelections as Array<Record<string, unknown>>).some(
            (s) => ownWebsiteIds.has(String(s.websiteId)) && s.approved && !s.isRejected && s.status === 'active',
          ))
          .map((ad) => ({
            id: `web-${ad.id}`,
            image: (ad.imageUrl as string) || null,
            title: (ad.businessName as string) || 'Ad',
            kind: 'website' as const,
          }));

        const youtubeAds: MyAd[] = adPosts.map((p) => ({
          id: `yt-${p.id}`,
          image: p.thumbnail_url || null,
          title: p.title,
          kind: 'youtube' as const,
        }));

        if (!cancelled) setMyAds([...youtubeAds, ...websiteAds]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <aside className="w-72 shrink-0 self-start sticky top-4 space-y-4 p-4">
      <Box title="Your websites">
        {loading ? (
          <div className="h-16 rounded-lg bg-background animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-white mb-2">{websites.length} connected</p>
            <div className="space-y-2 mb-3">
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
            <Link href="/?panel=websites" scroll={false} className="text-xs font-medium text-subtle hover:text-white">
              View all
            </Link>
          </>
        )}
      </Box>

      <MyAdsBox ads={myAds} loading={loading} />
    </aside>
  );
}
