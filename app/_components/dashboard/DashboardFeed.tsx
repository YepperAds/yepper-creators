'use client';

import { useState } from 'react';
import { CheckBadgeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import VideoEmbed from '@/app/_components/home/VideoEmbed';
import AdSpacesModal from '@/app/_components/home/AdSpacesModal';
import WebsiteLogoTile from './WebsiteLogoTile';
import type { PublicWebsite, PublicCreator } from '@/app/_lib/public-home';

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

function YoutuberCard({ creator, onCollaborate }: { creator: PublicCreator; onCollaborate: (creator: PublicCreator) => void }) {
  const videos = creator.videos || [];
  const [index, setIndex] = useState(0);
  const video = videos[index];
  const go = (delta: number) => setIndex((i) => (i + delta + videos.length) % videos.length);

  return (
    <div className="relative max-w-[340px] mx-auto rounded-2xl bg-surface-1 dark:bg-coral/8 border border-coral/15 overflow-hidden">
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-coral-text">Youtuber</p>
          <button
            onClick={() => onCollaborate(creator)}
            className="text-[11px] font-semibold text-white underline underline-offset-2 hover:text-coral-text transition-colors"
          >
            Collaborate with {creator.channelName}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {creator.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatar} alt={creator.name} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-surface-1 border border-border" />
          )}
          <div>
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold text-white font-(--font-display)">{creator.name}</p>
              <CheckBadgeIcon className="w-3.5 h-3.5 text-blue" />
            </div>
            <p className="text-[11px] text-muted">{formatCount(creator.subscribers)} subscribers</p>
          </div>
        </div>
      </div>

      {video && (
        <>
          <div className="relative aspect-[9/16] w-full bg-background">
            <VideoEmbed url={video.url} thumbnail={video.thumbnail} title={video.title} />
          </div>
          <div className="p-3 pt-2">
            <p className="text-xs font-medium text-white truncate">{video.title}</p>
            <p className="text-[11px] text-muted">{formatCount(video.views)} views</p>
          </div>
        </>
      )}

      {videos.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous video"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/75 flex items-center justify-center text-[#fff] transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next video"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/75 flex items-center justify-center text-[#fff] transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

function WebsiteCard({ website }: { website: PublicWebsite }) {
  return (
    <div className="rounded-2xl bg-[#0b0b0c] dark:bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-[#fff] dark:text-[#0b0b0c]">Website</p>
        <a
          href={website.websiteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-[#fff] dark:text-[#0b0b0c] underline underline-offset-2 hover:text-coral dark:hover:text-coral-dark transition-colors"
        >
          Advertise on {website.websiteName}
        </a>
      </div>

      <div className="flex gap-4">
        <a
          href={website.websiteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-32 sm:w-40 aspect-[4/3] shrink-0"
        >
          <WebsiteLogoTile website={website} className="absolute inset-0" />
          <span className="absolute bottom-1.5 right-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-[#fff]">View</span>
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

export default function DashboardFeed({ websites, creators }: { websites: PublicWebsite[]; creators: PublicCreator[] }) {
  const items = buildFeedItems(creators, websites, 12);
  const [collaborateWith, setCollaborateWith] = useState<PublicCreator | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted text-sm">
        No listings yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((item) =>
          item.type === 'creator'
            ? <YoutuberCard key={item.key} creator={item.data} onCollaborate={setCollaborateWith} />
            : <WebsiteCard key={item.key} website={item.data} />
        )}
      </div>
      <AdSpacesModal creator={collaborateWith} open={!!collaborateWith} onClose={() => setCollaborateWith(null)} />
    </>
  );
}
