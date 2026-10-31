'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const NAV_LINKS = [
  { label: 'For advertisers', href: '/advertisers' },
  { label: 'For publishers', href: '/publishers' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Explore', href: '/#explore' },
  { label: 'FAQ', href: '/faq' },
];

export default function HomeHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E8E6E0]">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">

        {/* Logo */}
        <Link href="/" aria-label="Yepper home" className="shrink-0">
          <Image
            src="/logos/yepper-logo.png"
            alt="Yepper"
            width={110}
            height={28}
            className="h-7 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop nav — plain text links, Aetherfield style */}
        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13.5px] font-medium text-[#444] transition-colors hover:text-[#0E0E0F]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA group */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="hidden text-[13.5px] font-medium text-[#444] transition hover:text-[#0E0E0F] sm:inline-flex"
          >
            Log in
          </Link>
          <Link href="/login" className="mkt-cta-black text-sm">
            Get started →
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E2DC] text-[#444] lg:hidden"
          >
            {mobileOpen ? <XMarkIcon className="h-4 w-4" /> : <Bars3Icon className="h-4 w-4" />}
          </button>

          {/* Mobile menu */}
          {mobileOpen && (
            <nav
              aria-label="Mobile navigation"
              className="absolute left-0 right-0 top-[60px] z-50 border-b border-[#E4E2DC] bg-white p-3 shadow-xl shadow-black/8 lg:hidden"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-[#0E0E0F] hover:bg-[#F5F3EE]"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-[#0E0E0F] hover:bg-[#F5F3EE]"
              >
                Log in
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
