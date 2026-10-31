'use client';

import { ArrowRightIcon, PlayIcon } from '@heroicons/react/24/solid';
import type { PublicCreator } from '@/app/_lib/public-home';

function startCreatorBooking(creator: PublicCreator) {
  const from = `/?panel=advertise&creatorId=${encodeURIComponent(creator.id)}`;
  window.location.href = `/login?from=${encodeURIComponent(from)}`;
}

function CreatorTile({ creator, previewOnly = false }: { creator: PublicCreator; previewOnly?: boolean }) {
  const isTikTok = creator.provider === 'tiktok';
  const audience = isTikTok ? creator.followers ?? 0 : creator.subscribers ?? 0;
  const video = creator.videos?.[0];
  const platform = isTikTok ? 'TikTok' : 'YouTube';
  const icon = isTikTok ? '/socials-icon/tiktok-icon.png' : '/socials-icon/youtube-icon.png';

  return (
    <button disabled={previewOnly} onClick={() => startCreatorBooking(creator)} className="group w-[290px] shrink-0 overflow-hidden rounded-[1.35rem] border border-[color:var(--mkt-border)] bg-white text-left shadow-[0_5px_20px_rgba(17,24,39,0.045)] transition duration-200 hover:-translate-y-1 hover:border-black/15 hover:shadow-[0_16px_40px_rgba(17,24,39,0.12)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-[color:var(--mkt-border)] disabled:hover:shadow-[0_5px_20px_rgba(17,24,39,0.045)] sm:w-[320px]">
      <div className="relative aspect-video overflow-hidden bg-[#151518]">
        {video?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : <div className="h-full w-full bg-gradient-to-br from-[#17171a] via-[#35353b] to-[#111113]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" className="h-3.5 w-3.5 object-contain" /> {platform}
        </span>
        <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[color:var(--mkt-ink)] shadow-lg transition group-hover:scale-105"><PlayIcon className="ml-0.5 h-4 w-4" /></span>
        {creator.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt="" className="absolute -bottom-5 left-3 h-11 w-11 rounded-full border-[3px] border-white bg-white object-cover" />
        )}
      </div>
      <div className="p-4 pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[color:var(--mkt-ink)]">{creator.channelName || creator.name}</h3>
            <p className="mt-1 truncate text-xs text-[color:var(--mkt-ink-muted)]">{creator.whatTheyDo || `${platform} creator`}</p>
          </div>
          <p className="shrink-0 text-right text-xs font-bold text-[color:var(--mkt-ink)]">{audience.toLocaleString()}<span className="mt-0.5 block text-[10px] font-medium text-[color:var(--mkt-ink-muted)]">{isTikTok ? 'followers' : 'subscribers'}</span></p>
        </div>
        <div className={`mt-4 flex items-center justify-between border-t border-[color:var(--mkt-border)] pt-3 text-xs font-bold ${previewOnly ? 'text-[color:var(--mkt-ink-muted)]' : 'text-blue'}`}>
          <span>{previewOnly ? 'Example listing' : 'Explore this channel'}</span>{!previewOnly && <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
        </div>
      </div>
    </button>
  );
}

export default function CreatorRow({ creators, previewOnly = false }: { creators: PublicCreator[]; previewOnly?: boolean }) {
  if (!creators.length) return null;
  return (
    <div className="yp-scroll-row -mx-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      {creators.map((creator) => <CreatorTile key={`${creator.provider ?? 'youtube'}-${creator.id}`} creator={creator} previewOnly={previewOnly} />)}
    </div>
  );
}
