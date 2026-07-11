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
      <div className="h-9 shrink-0 flex items-center gap-2 px-2 bg-[#f1f5f9] border-b border-black/10">
        <span className="flex items-center justify-center w-6 h-6 rounded-[5px] overflow-hidden bg-[#fff] ring-1 ring-black/10 shrink-0">
          {website.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <GlobeAltIcon className="w-full h-full text-slate-400 p-0.5" />
          )}
        </span>
        <span className="flex-1 min-w-0 h-5 rounded-full bg-[#fff] ring-1 ring-black/10 flex items-center px-2.5">
          <span className="text-[11px] font-medium text-slate-500 truncate leading-none">{domainOf(website.websiteLink)}</span>
        </span>
      </div>

      {/* Page body — a little wireframe (nav + hero + content grid), not just
          a flat color block, so the tile reads as an actual page layout. */}
      <div className="relative flex-1 overflow-hidden bg-[#f8fafc]">
        {/* Mini nav bar, tinted in the site's brand gradient */}
        <div className="h-[22%] flex items-center gap-[6%] px-[10%]" style={{ backgroundImage: siteGradient(website.id || website.websiteName) }}>
          <span className="w-[12%] aspect-square rounded-full bg-[#fff]/85 shrink-0" />
          <span className="ml-auto flex items-center gap-[6%]">
            <span className="w-[16%] h-1 rounded-full bg-[#fff]/70" />
            <span className="w-[16%] h-1 rounded-full bg-[#fff]/70" />
          </span>
        </div>

        {/* Content skeleton — fixed (not %) heights: this wrapper's own
            height is auto (sized to content), so percentage heights on its
            children would resolve to nothing per the CSS spec. */}
        <div className="p-[10%] space-y-1.5">
          <div className="h-1.5 w-3/4 rounded-full bg-slate-300" />
          <div className="h-1 w-1/2 rounded-full bg-slate-200" />
          <div className="flex gap-[6%] pt-1.5">
            <div className="flex-1 aspect-square rounded-md bg-slate-200" />
            <div className="flex-1 aspect-square rounded-md bg-slate-200" />
            <div className="flex-1 aspect-square rounded-md bg-slate-200" />
          </div>
        </div>

        <div className="yp-shimmer absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[#fff]/50 to-transparent" />
      </div>
    </div>
  );
}
