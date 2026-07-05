import { GlobeAltIcon } from '@heroicons/react/24/solid';
import type { PublicWebsite } from '@/app/_lib/public-home';

// A logo alone is flat, so each website tile gets its own deterministic
// brand-colored gradient (stable per site, not random per render) plus a
// slow light-sweep animation — the non-video equivalent of the YouTube
// cards' autoplay loop, so these tiles aren't just sitting there static.
function siteGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const angle = hash % 360;
  const midStop = 30 + (hash % 30);
  return `linear-gradient(${angle}deg, rgba(232,71,43,0.92) 0%, rgba(150,90,170,0.85) ${midStop}%, rgba(16,144,200,0.92) 100%)`;
}

export default function WebsiteLogoTile({ website, className }: { website: PublicWebsite; className?: string }) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className ?? ''}`}
      style={{ backgroundImage: siteGradient(website.id || website.websiteName) }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="yp-shimmer absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[#fff]/45 to-transparent" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-[12%]">
        <div className="yp-float bg-[#fff] rounded-lg shadow-lg p-1.5 w-[55%] h-[55%] flex items-center justify-center">
          {website.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt={website.websiteName} className="max-w-full max-h-full object-contain" />
          ) : (
            <GlobeAltIcon className="w-1/2 h-1/2 text-muted" />
          )}
        </div>
      </div>
    </div>
  );
}
