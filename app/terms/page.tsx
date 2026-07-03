import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Yepper Terms of Service.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-subtle hover:text-white underline underline-offset-2">
          &larr; Back to Yepper
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-white font-(--font-display)">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-subtle">
          <p>
            These Terms of Service are a placeholder. Replace this page with Yepper&apos;s actual
            terms covering account eligibility, publisher and advertiser obligations, payment and
            payout terms, content standards, and termination policy.
          </p>
          <p>
            Until finalized, this page exists so the link in the sign-in flow resolves instead of
            returning a 404.
          </p>
        </div>
      </div>
    </div>
  );
}
