import Image from 'next/image';
import Link from 'next/link';

export default function HomeHeader() {
  return (
    <header className="h-20 flex items-center">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logos/yepper-logo.png" alt="Yepper" width={120} height={32} className="h-8 w-auto object-contain" priority />
        </Link>

        <Link
          href="/login"
          className="inline-flex items-center h-11 px-6 rounded-full bg-[#0b0b0c] dark:bg-white text-[#fff] dark:text-[#0b0b0c] text-sm font-semibold hover:opacity-85 transition-opacity"
        >
          Login
        </Link>
      </div>
    </header>
  );
}
