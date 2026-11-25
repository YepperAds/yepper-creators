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
    return <div className="flex h-full w-full items-center justify-center text-xs text-white/45">No recent video available</div>;
  }

  // TikTok's embed player always exposes its own controls. Use the public
  // cover image in marketplace cards so previews stay silent and control-free.
  if (creator.provider === 'tiktok') {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-black">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt={video.title || `${creator.channelName} TikTok video`} className="h-full w-auto max-w-full object-contain" />
        ) : (
          <span className="text-xs text-white/45">No recent video available</span>
        )}
      </div>
    );
  }

  return <div className="h-full w-full overflow-hidden bg-black"><VideoEmbed url={video.url} thumbnail={video.thumbnail} title={video.title} /></div>;
}

export default function PlatformCreatorCard({
  creator,
  onClick,
  className = '',
  actionText,
  enablePartnerSelection = false,
  selected = false,
}: {
  creator: PublicCreator;
  onClick: () => void;
  className?: string;
  actionText?: string;
  enablePartnerSelection?: boolean;
  selected?: boolean;
}) {
  const isTikTok = creator.provider === 'tiktok';
  const platformName = isTikTok ? 'TikTok' : 'YouTube';
  const logoUrl = isTikTok ? '/socials-icon/tiktok-icon.png' : '/socials-icon/youtube-icon.png';
  const accent = '#E8472B';
  const audienceCount = creator.followers ?? creator.subscribers ?? 0;
  const audienceLabel = isTikTok ? 'followers' : 'subscribers';
  const channelName = creator.channelName || creator.username || creator.name;
  const identityLabel = isTikTok && creator.username
    ? `@${creator.username.replace(/^@+/, '')}`
    : channelName;
  const video = creator.videos?.[0];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={creator.isPartnerChannel && !enablePartnerSelection}
      aria-pressed={creator.isPartnerChannel && enablePartnerSelection ? selected : undefined}
      className={`flex h-full min-h-[360px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-2 text-left transition-colors hover:border-white/20 disabled:cursor-default ${className}`}
      style={selected ? { borderColor: accent } : undefined}
    >
      <span className="block h-1 w-full shrink-0 bg-coral" />
      <span className="flex h-[68px] shrink-0 items-center gap-3 px-4">
        {creator.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt={`${channelName} profile`} className="h-10 w-10 rounded-full border border-white/15 object-cover" />
        ) : isTikTok ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-3 text-sm font-bold text-white">
            {channelName.trim().replace(/^@+/, '').charAt(0).toUpperCase() || 'T'}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={platformName} className="h-10 w-10 rounded-full bg-white object-contain p-1.5" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-white">{identityLabel}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="h-4 w-4 shrink-0 object-contain" />
          </span>
          <span className="block truncate text-[11px] text-white/60">{formatCount(audienceCount)} {audienceLabel}</span>
        </span>
      </span>

      <span className="mx-3.5 block aspect-video shrink-0 overflow-hidden rounded-xl border border-border bg-black">
        <CurrentVideo creator={creator} />
      </span>

      <span className="flex min-h-[80px] flex-1 items-start justify-between gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-white">{video?.title || `Latest ${platformName} video`}</span>
          {isTikTok && creator.tiktokProfile && (
            <span className="mt-1 block truncate text-[10px] text-white/55">
              {creator.tiktokProfile.postsPerWeek} posts/wk · {creator.tiktokProfile.sponsoredPostsPerMonth} sponsored/mo
            </span>
          )}
        </span>
        {video && (!creator.isPartnerChannel || video.views > 0) && <span className="shrink-0 text-[10px] text-white/55">{formatCount(video.views)} views</span>}
      </span>
      <span className="mt-auto flex min-h-10 shrink-0 items-center border-t border-border px-4 py-2.5 text-xs font-semibold text-coral-text">
        {creator.isPartnerChannel && enablePartnerSelection
          ? selected ? 'Selected' : actionText || 'View packages'
          : actionText || `Advertise on ${channelName}`}
      </span>
    </button>
  );
}
