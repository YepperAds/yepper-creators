import Image from 'next/image';
import Link from 'next/link';

const NAV_LINKS = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Explore listings', href: '/#explore' },
];

export default function HomeHeader() {
  return (
    <header className="h-20 flex items-center border-b border-[color:var(--mkt-border)]">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logos/yepper-logo.png" alt="Yepper" width={120} height={32} className="h-8 w-auto object-contain" priority />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[color:var(--mkt-ink-muted)] hover:text-[color:var(--mkt-ink)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="inline-flex items-center h-10 px-5 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shrink-0"
        >
          Log in
        </Link>
      </div>
    </header>
  );
}
