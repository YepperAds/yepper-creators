import Image from 'next/image';

// Static showcase of public sample ad creatives (not real advertiser ads) —
// purely illustrative, so every card is non-interactive (no href/onClick,
// cursor-default) unlike the real Website/Hot Deal cards elsewhere in
// DashboardFeed / HotDealsSection.
const SAMPLE_ADS: { src: string; business: string }[] = [
  { src: '/ads-samples/ad1.jpg', business: 'Murukali' },
  { src: '/ads-samples/ad2.jpg', business: 'Business name' },
  { src: '/ads-samples/ad3.jpg', business: 'Business name' },
  { src: '/ads-samples/ad4.jpg', business: 'Business name' },
  { src: '/ads-samples/ad5.jpg', business: 'Business name' },
  { src: '/ads-samples/ad6.jpg', business: 'Business name' },
  { src: '/ads-samples/ad7.jpg', business: 'Business name' },
  { src: '/ads-samples/ad8.jpg', business: 'Business name' },
];

export default function AdsSamplePanel() {
  return (
    <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Sample Ads</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {SAMPLE_ADS.map((ad, i) => (
          <div
            key={i}
            className="group select-none cursor-default rounded-2xl border border-border bg-surface-3 overflow-hidden"
          >
            <div className="relative aspect-square w-full">
              <Image
                src={ad.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
                className="object-cover"
                draggable={false}
              />
              <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                Ad
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-coral)/20 text-[10px] font-bold text-(--color-coral-text)">
                {ad.business.charAt(0)}
              </span>
              <span className="min-w-0 truncate text-xs font-medium text-white">{ad.business}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
