import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  CheckIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import Reveal from '@/app/_components/shared/Reveal';

const channels = [
  { name: 'Website', icon: '/socials-icon/www-icon.png' },
  { name: 'YouTube', icon: '/socials-icon/youtube-icon.png' },
  { name: 'TikTok', icon: '/socials-icon/tiktok-icon.png' },
];

// ── Numbered feature row (Aetherfield style) ────────────────────────────────

const FEATURES = [
  {
    n: '001',
    title: 'Discover',
    body: 'Websites, YouTube channels, and TikTok creators — filtered by niche, platform, and audience size. Find media your target audience already trusts.',
    linkLabel: 'Browse listings',
    href: '/#explore',
  },
  {
    n: '002',
    title: 'Compare every detail',
    body: 'Formats, slot positions, pricing, and placement terms — all visible on each listing before you sign in or spend a dollar.',
    linkLabel: 'See how listings work',
    href: '/how-it-works',
  },
  {
    n: '003',
    title: 'Book directly',
    body: 'No agency in the middle. Once you find the right placement, you complete the flow directly with the media owner through Yepper.',
    linkLabel: 'Start as an advertiser',
    href: '/advertisers',
  },
  {
    n: '004',
    title: 'List and get discovered',
    body: 'Website publishers and creators set their own prices, describe their media, and let brands come to them through one clean marketplace.',
    linkLabel: 'List your media',
    href: '/publishers',
  },
];

// ── Mock marketplace card ───────────────────────────────────────────────────

function MarketplaceCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      {/* Browser chrome */}
      <div className="flex h-8 items-center gap-1.5 border-b border-[#F0EDE8] bg-[#FAFAF8] px-3">
        <i className="h-2 w-2 rounded-full bg-[#ff6259]" />
        <i className="h-2 w-2 rounded-full bg-[#f6bd4f]" />
        <i className="h-2 w-2 rounded-full bg-[#42c95a]" />
        <span className="ml-2 rounded-full border border-[#E4E2DC] bg-white px-3 py-0.5 text-[9px] text-[#9A9A9F]">
          yepper.cc / explore
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#1090C8]">Marketplace</p>
            <h3 className="mt-0.5 text-base font-bold text-[#0E0E0F]">Find your audience</h3>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF4FB]">
            <MagnifyingGlassIcon className="h-4 w-4 text-[#1090C8]" />
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#0E0E0F] px-2.5 py-1 text-[9px] font-semibold text-white">All media</span>
          <span className="rounded-full border border-[#E4E2DC] px-2.5 py-1 text-[9px] font-medium text-[#9A9A9F]">Technology</span>
          <span className="rounded-full border border-[#E4E2DC] px-2.5 py-1 text-[9px] font-medium text-[#9A9A9F]">Lifestyle</span>
          <span className="rounded-full border border-[#E4E2DC] px-2.5 py-1 text-[9px] font-medium text-[#9A9A9F]">Finance</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {channels.map((channel) => (
            <div key={channel.name} className="rounded-xl border border-[#E4E2DC] bg-[#FAFAF8] p-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Image src={channel.icon} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
              </div>
              <p className="mt-2 text-[9px] font-bold text-[#0E0E0F]">{channel.name}</p>
              <p className="mt-0.5 text-[8px] text-[#9A9A9F]">Ad spaces</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E4E2DC] bg-[#F7F5F2] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EAF4FB]">
              <GlobeAltIcon className="h-3.5 w-3.5 text-[#1090C8]" />
            </span>
            <span>
              <span className="block text-[9px] font-bold text-[#0E0E0F]">Independent media</span>
              <span className="block text-[8px] text-[#9A9A9F]">See listing details before you commit</span>
            </span>
          </div>
          <CheckIcon className="h-4 w-4 text-emerald-600" />
        </div>
      </div>
    </div>
  );
}

// ── Two-sided workflow card ──────────────────────────────────────────────────

function WorkflowCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      <div className="p-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#1090C8]">How it flows</p>
        <h3 className="mt-1 text-sm font-bold text-[#0E0E0F]">Two sides, one exchange</h3>
        <div className="mt-4 space-y-2">
          {[
            { role: 'Advertiser', action: 'Browse & pick a placement', icon: MegaphoneIcon, color: 'bg-[#EAF4FB] text-[#1090C8]' },
            { role: 'Yepper', action: 'Shows full listing details', icon: null, logo: true, color: 'bg-[#F5F3EE] text-[#5A5A60]' },
            { role: 'Media owner', action: 'Receives the campaign', icon: BuildingStorefrontIcon, color: 'bg-[#FEF3F0] text-[#E8472B]' },
          ].map((item) => (
            <div key={item.role} className="flex items-center gap-3 rounded-xl border border-[#E4E2DC] bg-[#FAFAF8] px-3 py-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                {item.logo
                  ? <Image src="/logos/yepper-logo.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                  : item.icon && <item.icon className="h-4 w-4" />
                }
              </span>
              <div>
                <p className="text-[10px] font-bold text-[#0E0E0F]">{item.role}</p>
                <p className="text-[9px] text-[#9A9A9F]">{item.action}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F0F7F3] px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-semibold text-[#3A7A5A]">No agency. No middlemen. Direct.</span>
        </div>
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

export default function MarketingShowcase() {
  return (
    <div style={{ background: '#FAFAF8' }}>

      {/* ── Section A: numbered feature list + marketplace card (Aetherfield split) */}
      <section className="py-20 sm:py-28 border-b border-[#E4E2DC]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            {/* Top headline */}
            <div className="mb-12 max-w-3xl">
              <h2 className="font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-5xl">
                Everything you need to find, compare, and book ad space.
              </h2>
            </div>

            <div className="grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-20 lg:items-start">
              {/* Left: numbered rows */}
              <div>
                {FEATURES.map((f) => (
                  <div key={f.n} className="mkt-feature-row group">
                    <span className="mt-0.5 shrink-0 text-[11px] font-bold tabular-nums text-[#C8C5BE]">{f.n}</span>
                    <div className="flex-1">
                      <h3 className="text-[15px] font-bold text-[#0E0E0F]">{f.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-[#5A5A60]">{f.body}</p>
                      <Link
                        href={f.href}
                        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1090C8] transition hover:gap-2.5"
                      >
                        {f.linkLabel} <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
                <div className="mt-8">
                  <Link href="/#explore" className="mkt-cta-black">
                    • Explore the marketplace
                  </Link>
                </div>
              </div>

              {/* Right: sticky marketplace card */}
              <div className="lg:sticky lg:top-[80px]">
                <MarketplaceCard />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Section B: warm cream texture + workflow card (Aetherfield tone 4 style) */}
      <section className="py-20 sm:py-28 mkt-warm-noise">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
              {/* Left: copy */}
              <div>
                <h2 className="font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-5xl">
                  Built for clarity.
                  <br />
                  <span className="italic font-normal text-[#5A5A60]">Designed for direct deals.</span>
                </h2>
                <p className="mt-5 text-base leading-7 text-[#5A5A60]">
                  Every listing on Yepper shows you the media owner&apos;s details, pricing, and ad formats in full — before you&apos;re asked to sign in or commit to anything. Both sides of the deal get what they need upfront.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center sm:text-left">
                  {[
                    { val: '3', label: 'Platforms in one place' },
                    { val: '0%', label: "Cut from publishers' listed price" },
                    { val: 'Direct', label: 'Advertiser–creator connection' },
                  ].map((s) => (
                    <div key={s.label} className="mkt-card text-left">
                      <p className="text-2xl font-bold text-[#0E0E0F]">{s.val}</p>
                      <p className="mt-1 text-xs leading-4 text-[#5A5A60]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: workflow card */}
              <div className="mx-auto w-full max-w-[420px] lg:max-w-none">
                <WorkflowCard />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
