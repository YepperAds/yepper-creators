import type { Metadata } from 'next';
import LegalDoc from '@/app/_components/shared/LegalDoc';
import { TERMS_SECTIONS } from '@/app/_components/shared/LegalContent';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Yepper Terms of Service.',
};

export default function TermsPage() {
  return (
    <LegalDoc
      label="Terms of Service"
      headline="Simple terms, for a marketplace built on direct deals"
      intro={[
        'These terms cover how Yepper connects publishers and advertisers directly (no agencies, no middlemen) and what we each owe one another to keep it that way.',
        'By using Yepper, you agree to the terms below.',
      ]}
      effectiveDate={String(new Date().getFullYear())}
      sections={TERMS_SECTIONS}
    />
  );
}
