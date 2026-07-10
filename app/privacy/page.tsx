import type { Metadata } from 'next';
import LegalDoc from '@/app/_components/shared/LegalDoc';
import { PRIVACY_SECTIONS } from '@/app/_components/shared/LegalContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Yepper Privacy Policy.',
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      label="Privacy Policy"
      headline="At Yepper, we respect your right to privacy"
      intro={[
        'The protection of your personal data is a matter of trust, and the trust of the publishers and advertisers who use Yepper is fundamental to us.',
        'This policy covers what data we collect, how it’s used, and who to contact about it.',
      ]}
      effectiveDate={String(new Date().getFullYear())}
      sections={PRIVACY_SECTIONS}
    />
  );
}
