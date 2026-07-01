import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import VideoEmbed from './VideoEmbed';
import type { PublicWebsite, PublicCreator, HotDealItem } from '@/app/_lib/public-home';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// A real channel + one of their actual videos (reuses VideoEmbed, same
// autoplay-loop tile used in HomeFeed.tsx) — not a static screenshot, so a
// hot deal's YouTube slot shows off real content instead of a placeholder.
function YoutubePlatformCard({ creator }: { creator: PublicCreator }) {
  const video = creator.videos?.[0];
  return (
    <div className="w-44 shrink-0 rounded-xl bg-black p-2.5">
      <div className="flex items-center gap-2 mb-2">
        {creator.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/10 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold text-white truncate">{creator.channelName || creator.name}</p>
            <CheckBadgeIcon className="w-3 h-3 text-[#3ea6ff] shrink-0" />
          </div>
          <p className="text-[10px] text-white/60">{formatCount(creator.subscribers)} subscribers</p>
        </div>
      </div>
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        {video ? (
          <VideoEmbed url={video.url} thumbnail={video.thumbnail} title={video.title} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-[10px]">No video yet</div>
        )}
      </div>
    </div>
  );
}

// A stylized "where the ad shows up" mockup — a page layout in the brand's
// deep sky-blue with an orange "Ad" popup nudging over it (.yp-adshake) —
// not a real screenshot of the site, since the point is to signal "this is
// an ad placement" at a glance, the way the reference design called for.
function WebsitePlatformCard({ website }: { website: PublicWebsite }) {
  return (
    <div className="w-44 shrink-0 rounded-xl bg-black p-2.5">
      <p className="text-xs font-bold text-[#38bdf8] truncate mb-2">{website.websiteName}</p>
      <div className="relative aspect-video rounded-lg overflow-hidden bg-[#0c3d5e]">
        <div className="absolute top-0 inset-x-0 h-4 bg-black/25 flex items-center gap-1 px-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
        </div>
        <div className="absolute inset-x-2 top-6 space-y-1.5">
          <div className="h-1.5 w-3/4 rounded bg-white/25" />
          <div className="h-1.5 w-1/2 rounded bg-white/15" />
          <div className="h-1.5 w-2/3 rounded bg-white/15" />
          <div className="h-1.5 w-1/3 rounded bg-white/15" />
        </div>
        <div className="yp-adshake absolute bottom-2 right-2 bg-[#f97316] text-white text-[9px] font-extrabold px-2 py-1 rounded-md shadow-lg">
          Ad
        </div>
      </div>
    </div>
  );
}

function renderTile(
  item: HotDealItem,
  creatorById: Map<string, PublicCreator>,
  websiteById: Map<string, PublicWebsite>,
  keyPrefix: string,
) {
  if (item.itemType === 'youtube') {
    const creator = item.creatorId != null ? creatorById.get(String(item.creatorId)) : undefined;
    return creator ? <YoutubePlatformCard key={`${keyPrefix}-${item.id}`} creator={creator} /> : null;
  }
  const website = item.websiteId ? websiteById.get(String(item.websiteId)) : undefined;
  return website ? <WebsitePlatformCard key={`${keyPrefix}-${item.id}`} website={website} /> : null;
}

// Slides slowly (only once there are enough tiles that sliding is actually
// useful) so a deal bundling many platforms doesn't need a wide/scroll
// gesture just to see what's included — see .yp-marquee in globals.css.
export default function PlatformCarousel({
  items,
  creators,
  websites,
}: {
  items: HotDealItem[];
  creators: PublicCreator[];
  websites: PublicWebsite[];
}) {
  const creatorById = new Map(creators.map((c) => [String(c.id), c]));
  const websiteById = new Map(websites.map((w) => [String(w.id), w]));

  const validItems = items.filter((item) =>
    item.itemType === 'youtube'
      ? item.creatorId != null && creatorById.has(String(item.creatorId))
      : !!item.websiteId && websiteById.has(String(item.websiteId)),
  );
  if (!validItems.length) return null;

  const shouldSlide = validItems.length > 3;
  return (
    <div className="overflow-hidden">
      <div className={`flex gap-3 ${shouldSlide ? 'yp-marquee w-max' : 'flex-wrap justify-center'}`}>
        {validItems.map((item, i) => renderTile(item, creatorById, websiteById, 'a' + i))}
        {shouldSlide && validItems.map((item, i) => renderTile(item, creatorById, websiteById, 'b' + i))}
      </div>
    </div>
  );
}
