import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Yepper Privacy Policy.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-subtle hover:text-white underline underline-offset-2">
          &larr; Back to Yepper
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-white font-(--font-display)">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-subtle">
          <p>
            This Privacy Policy is a placeholder. Replace this page with Yepper&apos;s actual policy
            covering what account, website, and payment data is collected (including via Google
            sign-in), how it&apos;s used, how it&apos;s shared with advertisers/publishers, and how
            users can request access to or deletion of their data.
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
