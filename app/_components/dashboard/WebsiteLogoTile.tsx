import { GlobeAltIcon } from '@heroicons/react/24/solid';
import type { PublicWebsite } from '@/app/_lib/public-home';

// A flat gradient alone doesn't read as "a website", so each tile is framed
// as a little browser window: a chrome bar up top carrying the site's real
// logo (favicon position, top-left) and its real domain (address-bar
// position), sat above a brand-colored page body. Gradient is deterministic
// per site (stable across renders, not random) so the same site always gets
// the same look; the light-sweep animation is the non-video equivalent of
// the YouTube cards' autoplay loop, so the "page" isn't just sitting static.
function siteGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const angle = hash % 360;
  const midStop = 30 + (hash % 30);
  return `linear-gradient(${angle}deg, rgba(232,71,43,0.92) 0%, rgba(150,90,170,0.85) ${midStop}%, rgba(16,144,200,0.92) 100%)`;
}

function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

// Deliberately no rounded-*/border here — callers own their own
// radius/clipping on whatever element bounds this tile (so a caller that
// nests it inside an already-rounded card never ends up with two
// mismatched radii fighting for the same corner).
export default function WebsiteLogoTile({ website, className }: { website: PublicWebsite; className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden bg-[#fff] ${className ?? ''}`}>
      {/* Browser chrome — real logo top-left (favicon position) + real
          domain (address-bar position), so the tile is unmistakably "a
          website" rather than a generic colored square. */}
      <div className="h-6 shrink-0 flex items-center gap-1.5 px-1.5 bg-[#f1f5f9] border-b border-black/10">
        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-[3px] overflow-hidden bg-[#fff] ring-1 ring-black/10 shrink-0">
          {website.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <GlobeAltIcon className="w-full h-full text-slate-400 p-px" />
          )}
        </span>
        <span className="flex-1 min-w-0 h-3.5 rounded-full bg-[#fff] ring-1 ring-black/10 flex items-center px-2">
          <span className="text-[9px] font-medium text-slate-500 truncate leading-none">{domainOf(website.websiteLink)}</span>
        </span>
      </div>

      {/* Page body */}
      <div className="relative flex-1 overflow-hidden" style={{ backgroundImage: siteGradient(website.id || website.websiteName) }}>
        <div className="yp-shimmer absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[#fff]/45 to-transparent" />
      </div>
    </div>
  );
}
