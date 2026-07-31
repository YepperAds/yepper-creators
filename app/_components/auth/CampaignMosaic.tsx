import Image from 'next/image';

// CampaignMosaic: the scrolling wall of campaign creatives on the right side
// of every full-screen auth-adjacent layout (login, onboarding, …). Shared so
// the two don't drift apart.

type MediaType = 'image' | 'gif' | 'video';

const BASE: { src: string; alt: string; type: MediaType }[] = [
  { src: '/campaigns/images/ad-1.png', alt: 'Campaign 1', type: 'image' },
  { src: '/campaigns/images/ad-2.png', alt: 'Campaign 2', type: 'image' },
  { src: '/campaigns/images/ad-3.gif', alt: 'Campaign 3', type: 'gif' },
  { src: '/campaigns/images/ad-4.png', alt: 'Campaign 4', type: 'image' },
  { src: '/campaigns/images/ad-5.png', alt: 'Campaign 5', type: 'image' },
  { src: '/campaigns/images/ad-6.png', alt: 'Campaign 6', type: 'image' },
  { src: '/campaigns/videos/ad-7.mp4', alt: 'Campaign 7', type: 'video' },
  { src: '/campaigns/videos/ad-8.mp4', alt: 'Campaign 8', type: 'video' },
];
const CAMPAIGNS = [
  ...BASE.map((c, i) => ({ ...c, id: i + 1 })),
  ...BASE.map((c, i) => ({ ...c, id: i + 9 })),
];

function CampaignTile({ src, alt, type }: { src: string; alt: string; type: MediaType }) {
  return (
    <div className="relative w-full flex-shrink-0 overflow-hidden rounded-[5px] bg-[#111]" style={{ aspectRatio: '4/3' }}>
      {type === 'video' ? (
        <video src={src} autoPlay muted loop playsInline className="w-full h-full object-cover" />
      ) : type === 'gif' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <Image src={src} alt={alt} fill sizes="12vw" className="object-cover" />
      )}
    </div>
  );
}

function ScrollColumn({ items, speed, offsetTop = 0 }: { items: typeof CAMPAIGNS; speed: number; offsetTop?: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="flex-1 overflow-hidden">
      <div style={{ marginTop: `-${offsetTop}px`, animation: `yp-scroll-up ${speed}s linear infinite` }}>
        <div className="flex flex-col gap-2">
          {doubled.map((c, i) => <CampaignTile key={`${c.id}-${i}`} src={c.src} alt={c.alt} type={c.type} />)}
        </div>
      </div>
    </div>
  );
}

export default function CampaignMosaic() {
  const colA = CAMPAIGNS.filter((_, i) => i % 3 === 0);
  const colB = CAMPAIGNS.filter((_, i) => i % 3 === 1);
  const colC = CAMPAIGNS.filter((_, i) => i % 3 === 2);

  return (
    <div
      className="hidden lg:flex flex-1 relative h-screen overflow-hidden"
      style={{ background: '#0C0C0C' }}
      aria-hidden="true"
    >
      <div className="absolute top-5 inset-x-0 z-20 flex justify-center pointer-events-none">
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#333' }}>
          Campaigns powered by Yepper
        </span>
      </div>
      <div className="flex gap-2 w-full h-full px-3 pt-10">
        <ScrollColumn items={colA} speed={25} />
        <ScrollColumn items={colB} speed={32} offsetTop={80} />
        <ScrollColumn items={colC} speed={28} offsetTop={40} />
      </div>
    </div>
  );
}
