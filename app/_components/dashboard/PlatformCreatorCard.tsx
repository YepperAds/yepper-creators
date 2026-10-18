'use client';

import VideoEmbed from '@/app/_components/home/VideoEmbed';
import type { PublicCreator } from '@/app/_lib/public-home';

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function CurrentVideo({ creator }: { creator: PublicCreator }) {
  const video = creator.videos?.[0];
  if (!video) {
    return <div className="flex aspect-video items-center justify-center bg-black text-xs text-white/55">No recent video available</div>;
  }

  if (creator.provider === 'tiktok' && video.embedUrl) {
    return (
      <div className="flex h-[260px] items-center justify-center bg-black p-2">
        <iframe
          src={video.embedUrl}
          title={video.title || `${creator.channelName} TikTok video`}
          loading="lazy"
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full aspect-[9/16] rounded-md bg-black"
        />
      </div>
    );
  }

  return <div className="aspect-video overflow-hidden bg-black"><VideoEmbed url={video.url} thumbnail={video.thumbnail} title={video.title} /></div>;
}

export default function PlatformCreatorCard({
  creator,
  onClick,
  className = '',
  actionText,
}: {
  creator: PublicCreator;
  onClick: () => void;
  className?: string;
  actionText?: string;
}) {
  const isTikTok = creator.provider === 'tiktok';
  const platformName = isTikTok ? 'TikTok' : 'YouTube';
  const logoUrl = isTikTok ? '/socials-icon/tiktok-icon.png' : '/socials-icon/youtube-icon.png';
  const accent = isTikTok ? '#25F4EE' : '#FF0033';
  const audienceCount = creator.followers ?? creator.subscribers ?? 0;
  const audienceLabel = isTikTok ? 'followers' : 'subscribers';
  const channelName = creator.channelName || creator.username || creator.name;
  const video = creator.videos?.[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 overflow-hidden rounded-xl border bg-[#101010] text-left transition-colors ${className}`}
      style={{ borderColor: `${accent}88` }}
    >
      <span className="block h-1 w-full" style={{ backgroundColor: accent }} />
      <span className="flex items-center gap-3 px-3.5 py-3">
        {creator.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt={`${channelName} profile`} className="h-10 w-10 rounded-full border border-white/15 object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={platformName} className="h-10 w-10 rounded-full bg-white object-contain p-1.5" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-white">{channelName}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="h-4 w-4 shrink-0 object-contain" />
          </span>
          <span className="block truncate text-[11px] text-white/60">{formatCount(audienceCount)} {audienceLabel}</span>
        </span>
      </span>

      <span className="mx-3.5 block overflow-hidden rounded-lg border border-white/10">
        <CurrentVideo creator={creator} />
      </span>

      <span className="flex items-center justify-between gap-3 px-3.5 py-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-white">{video?.title || `Latest ${platformName} video`}</span>
          {isTikTok && creator.tiktokProfile && (
            <span className="mt-1 block truncate text-[10px] text-white/55">
              {creator.tiktokProfile.postsPerWeek} posts/wk · {creator.tiktokProfile.sponsoredPostsPerMonth} sponsored/mo
            </span>
          )}
        </span>
        {video && <span className="shrink-0 text-[10px] text-white/55">{formatCount(video.views)} views</span>}
      </span>
      <span className="block border-t border-white/10 px-3.5 py-2.5 text-xs font-semibold" style={{ color: accent }}>
        {actionText || `Advertise on ${channelName}`}
      </span>
    </button>
  );
}