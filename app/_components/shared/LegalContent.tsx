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
      'The websites, YouTube channels, and TikTok accounts you connect to your account.',
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
    title: 'TikTok account and video data',
    points: [
      'If you choose to connect TikTok, Yepper receives the information authorized through TikTok Login Kit and the permissions you grant. Depending on the permissions requested and the TikTok API response, this may include your TikTok account identifier (such as open_id), display name, and avatar; public profile statistics such as follower, following, likes, or video counts only where Yepper requests the relevant permission and displays or uses those fields; and public video information for videos on your connected account, such as video ID, title or description, creation time, share URL, cover image URL, and metrics TikTok makes available, including views, likes, comments, and (where returned by TikTok and used by Yepper) shares.',
      'We use this information to connect your account, display the authorized TikTok profile information in Yepper, support creator-selected campaign posts, verify a submitted public video against your connected account, and show campaign reporting to authorized campaign participants.',
      'A Yepper campaign link placed in a TikTok bio may separately record clicks on that link. The link does not give Yepper access to TikTok bio analytics or fetch metrics for a TikTok video.',
      'TikTok\u2019s API metrics may be delayed, limited, or unavailable. A video view count is a count of video views as returned by TikTok; it is not an advertising impression or reach metric. Yepper does not use this API to obtain paid-ad impressions. We do not use this integration to access private videos or arbitrary TikTok accounts.',
      'The creator\u2014not Yepper\u2014publishes content to TikTok. Yepper does not post, edit, or manage TikTok content on your behalf through the API.',
    ],
  },
  {
    title: 'TikTok consent, authorization & revocation',
    points: [
      'You decide whether to connect TikTok and review the requested permissions in TikTok\u2019s authorization flow. You may disconnect within Yepper where available and revoke Yepper\u2019s access at any time through TikTok\u2019s account authorization settings.',
      'After revocation or disconnection, Yepper will no longer make new API requests using that authorization. Revocation stops future access when the authorization is no longer available; it does not by itself erase previously recorded transaction or campaign records that Yepper must retain for operational, accounting, or legal compliance.',
    ],
  },
  {
    title: 'TikTok tokens, service providers & data retention',
    points: [
      'TikTok may issue access and refresh tokens so Yepper can maintain the connection and request data you authorized. We do not sell TikTok account or video data.',
      'We retain TikTok connection data and retrieved account/video information only for as long as needed to provide the marketplace features, maintain campaign records, address disputes, and meet legal obligations.',
      'TikTok API responses can become stale, expire, or fail to refresh. Yepper displays the most recently retrieved values and the time of the last successful refresh, or indicates that current data is unavailable.',
      'If you upload a video for an available Yepper processing feature, we process it solely to provide the requested output file. We do not publish it to TikTok.',
    ],
  },
  {
    title: 'Third-party services',
    points: [
      'Google, for sign-in and, where you connect a channel, the YouTube API.',
      'TikTok, for creator account connection and video metrics via TikTok Login Kit and the Display API.',
      'A third-party payment processor; we never store full card details ourselves.',
    ],
  },
  {
    title: 'Data retention & deletion',
    points: [
      'We keep account and booking data for as long as your account is active, and as needed to meet legal, tax, and accounting obligations afterward.',
      'Disconnecting a website, YouTube channel, or TikTok account stops future data collection from it; previously recorded booking history is retained for accounting purposes.',
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
      'Disconnect a website, YouTube channel, or TikTok account at any time.',
      'Revoke Yepper\u2019s Google account access at any time from your Google Account permissions.',
      'Revoke Yepper\u2019s TikTok access at any time from your TikTok account authorization settings.',
      'Request account deletion at any time, from your dashboard settings or by contacting support@yepper.cc.',
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
      'By connecting a Google, YouTube, or TikTok account, you confirm you have the right to grant Yepper the access you\u2019re authorizing.',
    ],
  },
  {
    title: 'Using Yepper',
    points: [
      'You must own or have the right to list any website, YouTube channel, or TikTok account you connect.',
      'Any ad creative you post must comply with the destination platform\u2019s own policies (e.g. YouTube\u2019s ad and content guidelines or TikTok\u2019s terms, community rules, and branded content policies).',
      'If you upload a video for Yepper to insert an ad creative into, you confirm you own or have the right to use that video, and you are responsible for publishing the finished result yourself, in compliance with the destination platform\u2019s policies.',
    ],
  },
  {
    title: 'TikTok connection & creator publishing',
    points: [
      'If you choose to connect a TikTok account, you authorize Yepper to access the TikTok data and features shown in the TikTok consent flow, subject to your granted permissions and TikTok\u2019s API availability.',
      'You retain full responsibility for the videos and other content you create, upload, or publish on TikTok. Unless an expressly described feature is made available to you, Yepper does not post, edit, or manage TikTok content on your behalf.',
      'Before publishing sponsored or branded content, you are responsible for complying with TikTok\u2019s branded-content and advertising disclosures, community guidelines, and applicable law.',
      'TikTok video view_count represents views as reported by TikTok, not paid-ad impressions, reach guarantees, or verified unique viewers.',
      'TikTok is an independent third party; Yepper is not affiliated with or endorsed by TikTok.',
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
