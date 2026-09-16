import Image from 'next/image';

// Static showcase of public sample ad creatives (not real advertiser ads) —
// purely illustrative, so every card is non-interactive (no href/onClick,
// cursor-default) unlike the real Website/Hot Deal cards elsewhere in
// DashboardFeed / HotDealsSection. "Booked" is a static label (every slot
// here is a filled example), not a live status.
const SAMPLE_ADS: { src: string; business: string }[] = [
  { src: '/ads-samples/ad1.jpg', business: 'Murukali Market' },
  { src: '/ads-samples/ad2.jpg', business: 'Amys Candy' },
  { src: '/ads-samples/ad3.jpg', business: 'Radiant' },
  { src: '/ads-samples/ad4.jpg', business: 'Zion Temple' },
  { src: '/ads-samples/ad5.jpg', business: 'Odoo Business Show' },
  { src: '/ads-samples/ad6.jpg', business: 'SoulChild' },
  { src: '/ads-samples/ad7.jpg', business: 'Murukali Market' },
  { src: '/ads-samples/ad8.jpg', business: 'Serena Hotel' },
];

export default function AdsSamplePanel() {
  return (
    <div className="rounded-3xl border border-(--color-coral)/15 bg-gradient-to-b from-(--color-coral)/[0.06] to-surface-2 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-(--color-coral-text)">Sample Ads</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {SAMPLE_ADS.map((ad, i) => (
          <div
            key={i}
            className="select-none cursor-default rounded-2xl border border-white/5 bg-surface-3 overflow-hidden shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={ad.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 340px, 45vw"
                className="object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute top-2.5 left-2.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white">
                Ad
              </span>
              <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-(--color-coral) px-2.5 py-1 text-[10px] font-semibold text-white">
                Booked
              </span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-3 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-coral)/15 text-xs font-bold text-(--color-coral-text)">
                {ad.business.charAt(0)}
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-white">{ad.business}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
