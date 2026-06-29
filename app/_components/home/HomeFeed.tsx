'use client';

import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import VideoEmbed from './VideoEmbed';
import type { PublicWebsite, PublicCreator } from '@/app/_lib/public-home';

// Logged-out visitors can't collaborate yet — send them to log in, then land
// straight back on the dashboard's advertise panel with this exact
// website/creator already open, instead of dropping them on a blank feed.
function startCollaborate(param: 'creatorId' | 'websiteId', id: string) {
  const from = `/?panel=advertise&${param}=${encodeURIComponent(id)}`;
  window.location.href = `/login?from=${encodeURIComponent(from)}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

function YoutuberCard({ creator }: { creator: PublicCreator }) {
  return (
    <div className="rounded-2xl bg-surface-1 dark:bg-coral/8 border border-coral/15 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-coral-text">Youtuber</p>
        <button
          onClick={() => startCollaborate('creatorId', creator.id)}
          className="text-xs font-semibold text-white underline underline-offset-2 hover:text-coral-text transition-colors"
        >
          Collaborate with {creator.channelName}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        {creator.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt={creator.name} className="h-11 w-11 rounded-xl object-cover" />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-surface-1 border border-border" />
        )}
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-white font-(--font-display)">{creator.name}</p>
            <CheckBadgeIcon className="w-4 h-4 text-blue" />
          </div>
          <p className="text-xs text-muted">{formatCount(creator.subscribers)} subscribers</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(creator.videos || []).slice(0, 4).map((v, i) => (
          <div key={i} className="w-44 shrink-0">
            <div className="aspect-video rounded-xl overflow-hidden">
              <VideoEmbed url={v.url} thumbnail={v.thumbnail} title={v.title} />
            </div>
            <p className="mt-1.5 text-xs font-medium text-white truncate">{v.title}</p>
            <p className="text-[11px] text-muted">{formatCount(v.views)} views</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebsiteCard({ website }: { website: PublicWebsite }) {
  return (
    <div className="rounded-2xl bg-[#0b0b0c] dark:bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-[#fff] dark:text-[#0b0b0c]">Website</p>
        <button
          onClick={() => startCollaborate('websiteId', website.id)}
          className="text-xs font-semibold text-[#fff] dark:text-[#0b0b0c] underline underline-offset-2 hover:text-coral dark:hover:text-coral-dark transition-colors"
        >
          Advertise on {website.websiteName}
        </button>
      </div>

      <div className="flex gap-4">
        <a
          href={website.websiteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-32 sm:w-40 aspect-[4/3] shrink-0 rounded-lg overflow-hidden bg-surface-3"
        >
          {website.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt={website.websiteName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">No preview</div>
          )}
          <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">View</span>
        </a>

        <div className="flex flex-col justify-between min-w-0">
          <div>
            <p className="text-sm font-bold text-[#fff] dark:text-[#0b0b0c] font-(--font-display)">{website.websiteName}</p>
            {website.businessCategories?.length > 0 && (
              <p className="mt-1 text-sm text-[#fff]/70 dark:text-[#0b0b0c]/70">{website.businessCategories.join(' · ')}</p>
            )}
          </div>
          <p className="text-xs text-[#fff]/50 dark:text-[#0b0b0c]/50">{domainOf(website.websiteLink)}</p>
        </div>
      </div>
    </div>
  );
}

type FeedItem =
  | { type: 'creator'; key: string; data: PublicCreator }
  | { type: 'website'; key: string; data: PublicWebsite };

function buildFeedItems(creators: PublicCreator[], websites: PublicWebsite[], total: number): FeedItem[] {
  const items: FeedItem[] = [];
  let ci = 0;
  let wi = 0;
  for (let i = 0; i < total; i++) {
    const websiteSlot = (i + 1) % 3 === 0;
    if (websiteSlot && websites.length > 0) {
      items.push({ type: 'website', key: `w-${i}`, data: websites[wi % websites.length] });
      wi++;
    } else if (creators.length > 0) {
      items.push({ type: 'creator', key: `c-${i}`, data: creators[ci % creators.length] });
      ci++;
    } else if (websites.length > 0) {
      items.push({ type: 'website', key: `w-${i}`, data: websites[wi % websites.length] });
      wi++;
    }
  }
  return items;
}

export default function HomeFeed({ websites, creators }: { websites: PublicWebsite[]; creators: PublicCreator[] }) {
  const items = buildFeedItems(creators, websites, 12);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted text-sm">
        No listings yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) =>
        item.type === 'creator'
          ? <YoutuberCard key={item.key} creator={item.data} />
          : <WebsiteCard key={item.key} website={item.data} />
      )}
    </div>
  );
}
