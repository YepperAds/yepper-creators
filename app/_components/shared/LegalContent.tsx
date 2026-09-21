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
    title: 'Video processing',
    points: [
      'If you upload a video for Yepper to insert an advertiser\u2019s ad creative into, that file is processed on our servers solely to add the ad.',
      'Yepper does not publish, upload, or post that video anywhere. The finished file is made available for you to download and publish yourself, on your own channel, at your own discretion.',
      'Your original uploaded file is deleted from our servers as soon as processing finishes. The finished (ad-inserted) file is kept for 24 hours so you have time to download it, then automatically deleted.',
    ],
  },
  {
    title: 'Google user data & the API Services User Data Policy',
    points: [
      'Yepper\u2019s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
      'Yepper uses YouTube API Services. By using Yepper\u2019s YouTube features you agree to be bound by the YouTube Terms of Service (https://www.youtube.com/t/terms) and the Google Privacy Policy (https://policies.google.com/privacy).',
      'Where you connect your channel, we use read-only access (the youtube.readonly scope) to read your channel name, subscriber, view and video counts, profile picture, and the title, thumbnail, view count and like count of your latest videos. We use this to show your channel stats on your Yepper dashboard, to set your ad pricing tier from your subscriber count, and to show your channel on your creator listing to advertisers on Yepper. We cannot post, edit, delete, or manage anything on your channel.',
      'Separately, to track the performance of an ad you\u2019ve published, we look up the public view and engagement statistics of that specific video through the YouTube Data API, using its video ID \u2014 this uses a general API key, not your personal Google account access, and only looks up videos identified by their tracking code.',
      'We do not use Google user data to serve ads, and we do not sell, rent, or transfer it to third parties, except where necessary to run the service (e.g. our payment processor for payouts) or where required by law.',
      'To keep your channel stats up to date, we store the access credentials Google issues to us for your channel on our servers. They are deleted when you disconnect your channel.',
      'Access to Google user data within our systems is limited to the staff and automated processes that need it to operate the feature it supports.',
      'You can revoke Yepper\u2019s access to your Google account at any time from your Google Account permissions page (https://security.google.com/settings/security/permissions).',
    ],
  },
  {
    title: 'Third-party services',
    points: [
      'Google, for sign-in and, where you connect a channel, the YouTube API.',
      'A third-party payment processor; we never store full card details ourselves.',
    ],
  },
  {
    title: 'Data retention & deletion',
    points: [
      'We keep account and booking data for as long as your account is active, and as needed to meet legal, tax, and accounting obligations afterward.',
      'Disconnecting a website or YouTube channel stops future data collection from it; previously recorded booking history is retained for accounting purposes.',
      'Requesting account deletion removes your profile and connected-account data from our active systems, aside from records we\u2019re legally required to retain.',
    ],
  },
  {
    title: 'Security',
    points: [
      'We use industry-standard safeguards \u2014 encrypted connections, access controls, and restricted internal access \u2014 to protect your data.',
      'No method of transmission or storage is completely secure; we work to promptly address any issue we become aware of.',
    ],
  },
  {
    title: 'Children\u2019s privacy',
    points: [
      'Yepper is not directed at children under 13, and we do not knowingly collect data from them. If you believe a child has provided us data, contact us and we will remove it.',
    ],
  },
  {
    title: 'Your choices',
    points: [
      'Disconnect a website or YouTube channel at any time.',
      'Revoke Yepper\u2019s Google account access at any time from your Google Account permissions.',
      'Request account deletion at any time, from your dashboard settings or by contacting us.',
    ],
  },
  {
    title: 'Contact us',
    points: [
      'Questions about this policy or your data can be sent to support@yepper.cc.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Eligibility',
    points: [
      'You must be at least 18 years old, or the age of majority in your jurisdiction, to use Yepper.',
      'By connecting a Google or YouTube account, you confirm you have the right to grant Yepper the access you\u2019re authorizing.',
    ],
  },
  {
    title: 'Using Yepper',
    points: [
      'You must own or have the right to list any website or channel you connect.',
      'Any ad creative you post must comply with the destination platform\u2019s own policies (e.g. YouTube\u2019s ad and content guidelines).',
      'If you upload a video for Yepper to insert an ad creative into, you confirm you own or have the right to use that video, and you are responsible for publishing the finished result yourself, in compliance with the destination platform\u2019s policies.',
    ],
  },
  {
    title: 'Pricing & payouts',
    points: [
      'Publishers set listing visibility within their assigned traffic tier.',
      'Advertisers pay the listed price plus Yepper\u2019s margin.',
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
    title: 'Intellectual property',
    points: [
      'You retain ownership of the content and ad creatives you upload; you grant Yepper a license to display and distribute them as needed to run the service.',
      'Yepper\u2019s branding, software, and platform design remain our property.',
    ],
  },
  {
    title: 'Disclaimers & limitation of liability',
    points: [
      'Yepper is provided \u201cas is,\u201d without warranties of any kind, to the fullest extent permitted by law.',
      'Yepper is not liable for indirect, incidental, or consequential damages arising from use of the platform, to the fullest extent permitted by law.',
    ],
  },
  {
    title: 'Termination',
    points: [
      'Either side can close their account at any time.',
      'We may suspend accounts that violate these terms, with notice where reasonably possible.',
    ],
  },
  {
    title: 'Changes to these terms',
    points: [
      'We may update these terms from time to time; continued use of Yepper after changes take effect means you accept the updated terms.',
    ],
  },
  {
    title: 'Governing law',
    points: [
      'These terms are governed by the laws of the jurisdiction in which Yepper operates, without regard to conflict-of-law principles.',
    ],
  },
  {
    title: 'Contact us',
    points: [
      'Questions about these terms can be sent to yepperads@gmail.com',
    ],
  },
];