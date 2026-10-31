'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowRightIcon, GlobeAltIcon, PlayIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { PublicWebsite, PublicCreator } from '@/app/_lib/public-home';

function startCollaborate(id: string) {
  const from = `/?panel=advertise&websiteId=${encodeURIComponent(id)}`;
  window.location.href = `/login?from=${encodeURIComponent(from)}`;
}

function startCreatorBooking(creator: PublicCreator) {
  const from = `/?panel=advertise&creatorId=${encodeURIComponent(creator.id)}`;
  window.location.href = `/login?from=${encodeURIComponent(from)}`;
}

function cleanDomain(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || link;
  }
}

export default function ExploreDirectory({
  websites,
  creators,
  usesSampleWebsites,
  usesSampleCreators,
}: {
  websites: PublicWebsite[];
  creators: PublicCreator[];
  usesSampleWebsites?: boolean;
  usesSampleCreators?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'websites' | 'youtube' | 'tiktok'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Collect all unique categories
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    websites.forEach((w) => w.businessCategories?.forEach((c) => c !== 'any' && set.add(c)));
    return Array.from(set);
  }, [websites]);

  // Filter websites
  const filteredWebsites = useMemo(() => {
    if (activeTab === 'youtube' || activeTab === 'tiktok') return [];
    if (selectedCategory === 'all') return websites;
    return websites.filter((w) =>
      w.businessCategories?.some((c) => c.toLowerCase() === selectedCategory.toLowerCase())
    );
  }, [websites, activeTab, selectedCategory]);

  // Filter creators
  const filteredCreators = useMemo(() => {
    if (activeTab === 'websites') return [];
    let list = creators;
    if (activeTab === 'youtube') list = list.filter((c) => (c.provider ?? 'youtube') === 'youtube');
    if (activeTab === 'tiktok') list = list.filter((c) => c.provider === 'tiktok');
    return list;
  }, [creators, activeTab]);

  return (
    <div className="space-y-8">
      {/* ── Control bar: Tabs & Categories ────────────────────────── */}
      <div className="flex flex-col gap-5 border-b border-[#E4E2DC] pb-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Main platform tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All media', count: websites.length + creators.length },
            { id: 'websites', label: 'Websites', count: websites.length },
            { id: 'youtube', label: 'YouTube', count: creators.filter((c) => (c.provider ?? 'youtube') === 'youtube').length },
            { id: 'tiktok', label: 'TikTok', count: creators.filter((c) => c.provider === 'tiktok').length },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-[#0E0E0F] text-white shadow-xs'
                    : 'border border-[#E4E2DC] bg-white text-[#5A5A60] hover:border-[#0E0E0F] hover:text-[#0E0E0F]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-[#F0EDE8] text-[#7A7A80]'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category filter pills */}
        {allCategories.length > 0 && activeTab !== 'tiktok' && (
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-medium text-[#9A9A9F] mr-1">Niche:</span>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                selectedCategory === 'all'
                  ? 'bg-[#0E0E0F] text-white'
                  : 'bg-[#F0EDE8] text-[#5A5A60] hover:bg-[#E4E2DC]'
              }`}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-[#0E0E0F] text-white'
                    : 'bg-[#F0EDE8] text-[#5A5A60] hover:bg-[#E4E2DC]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Editorial Grid of Placements ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Render filtered websites */}
        {filteredWebsites.map((website, index) => {
          const domain = cleanDomain(website.websiteLink);
          const categories = (website.businessCategories ?? []).filter((c) => c !== 'any');
          return (
            <div
              key={`site-${website.id}-${index}`}
              onClick={() => startCollaborate(website.id)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#0E0E0F]/30 hover:shadow-lg cursor-pointer"
            >
              <div>
                {/* Header row: Icon, Name & Tier */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FB] text-[#1090C8]">
                      {website.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={website.imageUrl} alt="" className="h-6 w-6 object-contain rounded" />
                      ) : (
                        <GlobeAltIcon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-bold text-[#0E0E0F] group-hover:text-[#1090C8] transition-colors">
                        {website.websiteName}
                      </h4>
                      <p className="truncate text-xs font-medium text-[#7A7A80]">{domain}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#E4E2DC] bg-[#FAFAF8] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5A5A60]">
                    {website.trafficTier || 'Standard'}
                  </span>
                </div>

                {/* Category tags */}
                {categories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <span key={c} className="rounded-md bg-[#F4F2ED] px-2 py-0.5 text-[11px] font-medium text-[#5A5A60]">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Available formats preview */}
                <div className="mt-5 space-y-2 rounded-xl bg-[#FAFAF8] p-3 text-xs">
                  <div className="flex items-center justify-between text-[#7A7A80]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                      Header banner
                    </span>
                    <span className="text-[11px] font-semibold text-[#0E0E0F]">Available</span>
                  </div>
                  <div className="flex items-center justify-between text-[#7A7A80]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                      In-content placement
                    </span>
                    <span className="text-[11px] font-semibold text-[#0E0E0F]">Available</span>
                  </div>
                </div>
              </div>

              {/* Bottom action row */}
              <div className="mt-6 flex items-center justify-between border-t border-[#F0EDE8] pt-4">
                <span className="text-xs font-semibold text-[#1090C8]">
                  {usesSampleWebsites ? 'Sample listing' : 'Direct publisher deal'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0E0E0F] group-hover:text-[#1090C8] transition-colors">
                  Explore spaces <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          );
        })}

        {/* Render filtered creators */}
        {filteredCreators.map((creator, index) => {
          const isTikTok = creator.provider === 'tiktok';
          const platform = isTikTok ? 'TikTok' : 'YouTube';
          const audience = isTikTok ? creator.followers ?? 0 : creator.subscribers ?? 0;
          const video = creator.videos?.[0];
          const icon = isTikTok ? '/socials-icon/tiktok-icon.png' : '/socials-icon/youtube-icon.png';

          return (
            <div
              key={`creator-${creator.provider ?? 'youtube'}-${creator.id}-${index}`}
              onClick={() => startCreatorBooking(creator)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#0E0E0F]/30 hover:shadow-lg cursor-pointer"
            >
              <div>
                {/* Visual Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-[#18181B]">
                  {video?.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#202025] to-[#111114]">
                      <PlayIcon className="h-8 w-8 text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Platform badge */}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                    <Image src={icon} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                    {platform}
                  </span>

                  {/* Audience badge */}
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#0E0E0F] backdrop-blur-md">
                    {audience.toLocaleString()} {isTikTok ? 'followers' : 'subs'}
                  </span>

                  {/* Channel info over video */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2.5">
                    {creator.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creator.avatar}
                        alt=""
                        className="h-9 w-9 rounded-full border-2 border-white object-cover shadow-sm shrink-0"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white text-xs font-bold text-[#0E0E0F]">
                        {creator.channelName?.[0] || 'C'}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white drop-shadow-sm">
                        {creator.channelName || creator.name}
                      </p>
                      <p className="truncate text-[11px] text-white/80">
                        {creator.whatTheyDo || `${platform} creator`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details in card body */}
                <div className="p-5">
                  <div className="flex items-center justify-between text-xs text-[#5A5A60]">
                    <span>Verified channel</span>
                    <span className="font-semibold text-[#0E0E0F]">
                      {creator.totalViews ? `${creator.totalViews.toLocaleString()} views` : 'Direct partnership'}
                    </span>
                  </div>

                  {video?.title && (
                    <div className="mt-3 rounded-xl bg-[#FAFAF8] p-3 text-xs text-[#5A5A60]">
                      <p className="line-clamp-1 font-medium text-[#0E0E0F]">
                        Latest: &ldquo;{video.title}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom action row */}
              <div className="flex items-center justify-between border-t border-[#F0EDE8] px-5 py-4">
                <span className="text-xs font-semibold text-[#1090C8]">
                  {usesSampleCreators ? 'Sample creator' : 'Sponsorship ready'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0E0E0F] group-hover:text-[#1090C8] transition-colors">
                  View options <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state if filtering yields nothing */}
      {filteredWebsites.length === 0 && filteredCreators.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E4E2DC] py-16 text-center">
          <p className="text-sm font-medium text-[#5A5A60]">No placements found for this filter.</p>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSelectedCategory('all');
            }}
            className="mt-3 text-xs font-bold text-[#1090C8] underline"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
