import Image from 'next/image';
import Link from 'next/link';

const FOOTER_LINKS = [
  {
    heading: 'Platform',
    links: [
      { label: 'For advertisers', href: '/advertisers' },
      { label: 'For publishers', href: '/publishers' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Explore listings', href: '/#explore' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'FAQ & support', href: '/faq' },
      { label: 'Contact support', href: 'mailto:support@yepper.cc' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[#E4E2DC] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand col */}
          <div className="max-w-xs">
            <Link href="/" aria-label="Yepper home" className="inline-flex">
              <Image
                src="/logos/yepper-logo.png"
                alt="Yepper"
                width={110}
                height={28}
                className="h-7 w-auto object-contain"
              />
            </Link>
            <p className="mt-4 text-sm leading-6 text-[#5A5A60]">
              The direct advertising marketplace — connecting brands with independent websites, YouTube creators, and TikTok stars.
            </p>
            <a
              href="mailto:support@yepper.cc"
              className="mt-5 inline-flex text-xs font-semibold text-[#1090C8] hover:underline"
            >
              support@yepper.cc
            </a>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A9A9F]">{col.heading}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-[#5A5A60] transition hover:text-[#0E0E0F]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-3 border-t border-[#E4E2DC] pt-6 text-xs text-[#9A9A9F] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Yepper. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#0E0E0F]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#0E0E0F]">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
