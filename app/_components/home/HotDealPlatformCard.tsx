import { CheckBadgeIcon, PlayIcon } from '@heroicons/react/24/solid';
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
// The red ring + play sticker just dress the frame up to match the
// cartoonish website tile next to it; the avatar/video themselves are real.
function YoutubePlatformCard({ creator }: { creator: PublicCreator }) {
  const video = creator.videos?.[0];
  return (
    <div className="w-32 shrink-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        {creator.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 ring-2 ring-[#ff0000]/25" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-black/10 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-bold text-black truncate">{creator.channelName || creator.name}</p>
            <CheckBadgeIcon className="w-2.5 h-2.5 text-[#3ea6ff] shrink-0" />
          </div>
          <p className="text-[9px] text-black/55">{formatCount(creator.subscribers)} subscribers</p>
        </div>
      </div>
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-2 ring-[#ff0000]/20">
        {video ? (
          <VideoEmbed url={video.url} thumbnail={video.thumbnail} title={video.title} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#fff]/40 text-[9px]">No video yet</div>
        )}
        <div className="yp-pulse-pop absolute top-1 left-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-[#ff0000] shadow-md">
          <PlayIcon className="w-2 h-2 text-[#fff]" />
        </div>
      </div>
    </div>
  );
}

// A cartoon "where the ad shows up" sticker — a sunny sky, drifting clouds,
// a little storefront awning and a starburst "AD" sticker nudging over it —
// deliberately illustrated rather than a realistic browser mockup, since the
// point is a fun, promo-poster read ("your ad pops up on real sites"), not a
// literal screenshot of any one site.
function WebsitePlatformCard({ website }: { website: PublicWebsite }) {
  return (
    <div className="w-32 shrink-0">
      <p className="text-[11px] font-bold text-[#0284c7] truncate mb-1.5">{website.websiteName}</p>
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-b from-[#7dd3fc] to-[#38bdf8]">
        {/* Cartoon sun, top-left, with a soft radiating halo */}
        <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 rounded-full bg-[#fde047] shadow-[0_0_0_3px_rgba(253,224,71,0.45),0_0_10px_2px_rgba(253,224,71,0.5)]" />

        {/* Drifting cloud blobs */}
        <div className="yp-cloud-drift absolute top-2 right-3 flex items-center">
          <span className="w-3 h-2 rounded-full bg-[#fff]/85" />
          <span className="w-2 h-2.5 rounded-full bg-[#fff]/85 -ml-1" />
        </div>
        <div className="yp-cloud-drift absolute top-5 right-7 flex items-center" style={{ animationDelay: '1.5s' }}>
          <span className="w-2 h-1.5 rounded-full bg-[#fff]/70" />
          <span className="w-1.5 h-2 rounded-full bg-[#fff]/70 -ml-0.5" />
        </div>

        {/* Sparkle accents */}
        <span className="yp-sparkle absolute top-1 right-1 w-1 h-1 rounded-full bg-[#fff]" />
        <span className="yp-sparkle absolute bottom-6 left-2 w-1 h-1 rounded-full bg-[#fff]" style={{ animationDelay: '0.6s' }} />

        {/* Cartoon storefront: striped awning + door, sitting on the "ground" */}
        <div className="absolute bottom-0 inset-x-0 h-3.5 bg-[#0369a1]/25" />
        <div className="absolute bottom-3.5 inset-x-2 h-2 rounded-t-md overflow-hidden flex">
          <span className="flex-1 bg-[#fff]" />
          <span className="flex-1 bg-[#fb923c]" />
          <span className="flex-1 bg-[#fff]" />
          <span className="flex-1 bg-[#fb923c]" />
          <span className="flex-1 bg-[#fff]" />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-t-sm bg-[#7c4a1e]" />

        {/* Starburst "Ad" sticker nudging over the scene */}
        <div className="yp-adshake absolute bottom-1 right-1 z-10 flex items-center justify-center w-6 h-6 yp-starburst bg-[#fb923c] shadow-lg">
          <span className="text-[7px] font-extrabold text-[#fff] leading-none">AD</span>
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
