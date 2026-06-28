'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VideoCameraIcon, PlusIcon, GlobeAltIcon, FilmIcon } from '@heroicons/react/24/outline';

interface OwnWebsite { id: string | number; websiteName: string; imageUrl: string | null }
interface OwnYoutubeAccount { username: string; followers: number; avatar: string }

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Chip({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="shrink-0 flex items-center gap-2 rounded-full border border-border bg-surface-1 pl-2 pr-3 py-1.5 hover:border-coral/40 transition-colors"
    >
      {icon}
      <span className="text-xs font-semibold text-white truncate max-w-[140px]">{label}</span>
      {sub && <span className="text-[11px] text-muted">{sub}</span>}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">{label}</p>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">{children}</div>
    </div>
  );
}

// Defaults to "everything connected" so this never flashes on screen for
// users who actually have a website/YouTube linked — it only appears once
// we've confirmed something is actually missing or loaded.
export default function OwnContentCTA() {
  const [loaded, setLoaded] = useState(false);
  const [websites, setWebsites] = useState<OwnWebsite[]>([]);
  const [youtube, setYoutube] = useState<OwnYoutubeAccount | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sessRes = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
        const sessJson = await sessRes.json().catch(() => ({}));
        const userId = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
        if (!userId || cancelled) return;

        const [wRes, sRes] = await Promise.all([
          fetch(`/api/proxy/api/websites/${userId}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/social/stats?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' }),
        ]);
        if (cancelled) return;

        const wJson = await wRes.json().catch(() => ({}));
        const ownWebsites = Array.isArray(wJson) ? wJson : (wJson?.data ?? []);

        const sJson = await sRes.json().catch(() => ({}));
        const accounts = Array.isArray(sJson?.data) ? sJson.data : [];
        const yt = accounts.find((a: { provider: string }) => a.provider === 'youtube') ?? null;

        if (!cancelled) {
          setWebsites(ownWebsites);
          setYoutube(yt);
          setLoaded(true);
        }
      } catch {
        // fails quiet, not worth surfacing a CTA over a network blip
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const hasWebsite = websites.length > 0;
  const hasYoutube = !!youtube;

  if (loaded && !hasWebsite && !hasYoutube) {
    return (
      <div className="mb-5 rounded-2xl border border-coral/20 bg-surface-1 dark:bg-coral/5 p-4 flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-white flex-1 min-w-[220px]">
          Get your own website or channel showing up here on Yepper.
        </p>
        <div className="flex gap-2">
          <Link
            href="/?panel=add-website"
            scroll={false}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-coral text-white hover:bg-coral-dark transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add your website
          </Link>
          <Link
            href="/?panel=connect-accounts"
            scroll={false}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-blue text-white hover:bg-blue-dark transition-colors"
          >
            <VideoCameraIcon className="w-3.5 h-3.5" /> Connect YouTube
          </Link>
        </div>
      </div>
    );
  }

  if (!hasWebsite && !hasYoutube) return null;

  return (
    <div className="mb-5 rounded-2xl border border-border/60 bg-surface-1/40 p-3">
      {hasWebsite && (
        <Row label="Your websites">
          {websites.map((w) => (
            <Chip
              key={w.id}
              href={`/?panel=websites&websiteId=${w.id}`}
              icon={
                w.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <GlobeAltIcon className="w-4 h-4 shrink-0 text-muted" />
                )
              }
              label={w.websiteName}
            />
          ))}
          <Chip href="/?panel=add-website" icon={<PlusIcon className="w-4 h-4 shrink-0 text-muted" />} label="Add website" />
        </Row>
      )}

      {hasYoutube ? (
        <Row label="Your YouTube channel">
          <Chip
            href={youtube!.avatar || '/?panel=connect-accounts'}
            icon={<FilmIcon className="w-4 h-4 shrink-0 text-muted" />}
            label={youtube!.username || 'Your channel'}
            sub={`${formatCount(youtube!.followers)} subs`}
          />
        </Row>
      ) : (
        <Row label="Your YouTube channel">
          <Chip href="/?panel=connect-accounts" icon={<VideoCameraIcon className="w-4 h-4 shrink-0 text-muted" />} label="Connect YouTube" />
        </Row>
      )}
    </div>
  );
}
