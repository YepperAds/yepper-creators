// Source of truth for Privacy Policy / Terms of Use copy, rendered by the
// dedicated /privacy and /terms routes; see LegalDoc.tsx.

export interface LegalSection {
  title: string;
  points: string[];
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Information we collect',
    points: [
      'Account details from Google sign-in: your name, email, and profile photo.',
      'The websites and YouTube channels you connect to your account.',
      'Usage data needed to run the marketplace: bookings, payments, and ad performance.',
    ],
  },
  {
    title: 'How we use your data',
    points: [
      'To run your account and process payouts.',
      'To report on ad bookings and campaign performance.',
      'To keep the platform secure. We never sell your data to third parties.',
    ],
  },
  {
    title: 'Third-party services',
    points: [
      'Google, for sign-in.',
      'YouTube’s API, to read public channel and video stats for connected creators.',
      'A third-party payment processor; we never store full card details ourselves.',
    ],
  },
  {
    title: 'Your choices',
    points: [
      'Disconnect a website or YouTube channel at any time.',
      'Request account deletion at any time, from your dashboard settings.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Using Yepper',
    points: [
      'You must own or have the right to list any website or channel you connect.',
      'Any ad creative you post must comply with the destination platform’s own policies (e.g. YouTube’s ad and content guidelines).',
    ],
  },
  {
    title: 'Pricing & payouts',
    points: [
      'Publishers set listing visibility within their assigned traffic tier.',
      'Advertisers pay the listed price plus Yepper’s margin.',
      'Payouts to publishers are released after a booking is confirmed delivered.',
    ],
  },
  {
    title: 'Prohibited use',
    points: [
      'No fraudulent traffic, fake subscriber or view counts, or misleading ad content.',
      'Accounts found gaming verification or tier placement may be suspended.',
    ],
  },
  {
    title: 'Termination',
    points: [
      'Either side can close their account at any time.',
      'We may suspend accounts that violate these terms, with notice where reasonably possible.',
    ],
  },
];

