'use client';

import { useState } from 'react';

const TABS = ['Overview', 'Privacy Policy', 'Terms of Use'] as const;
type Tab = typeof TABS[number];

function Overview() {
  return (
    <div className="space-y-5 text-sm text-subtle leading-relaxed">
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">What Yepper is</h3>
        <p>
          Yepper is a marketplace that connects publishers — website owners and YouTube creators — directly
          with advertisers. No agencies, no middlemen guessing at rates: publishers list their audience,
          advertisers book the space they want, and Yepper handles placement, payment, and reporting for both sides.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">For publishers</h3>
        <p>
          Verify your website or YouTube channel and we place it in a traffic tier based on your audience size.
          Ad spaces are priced by tier, and you keep 100% of the listed price — Yepper&apos;s margin is added on
          top of what advertisers pay, never taken out of your payout.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">For advertisers</h3>
        <p>
          Browse verified websites and creators by category and audience size, then book the spaces that fit
          your campaign. Every listing is tier-verified, so you know what you&apos;re paying for before you commit.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Verification &amp; tiers</h3>
        <p>
          Every site or channel goes through a verification check before it&apos;s listed. Traffic tiers
          (Starter through Elite) are reviewed periodically as audiences grow, so pricing always reflects
          real reach.
        </p>
      </div>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div className="space-y-5 text-sm text-subtle leading-relaxed">
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">What we collect</h3>
        <p>
          Account details from Google sign-in (name, email, profile photo), the websites and channels you
          connect, and basic usage data needed to run the marketplace — bookings, payments, and ad performance.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">How we use it</h3>
        <p>
          To run your account, place and report on ad bookings, process payouts, and keep the platform secure.
          We don&apos;t sell your data to third parties.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Third parties</h3>
        <p>
          We use Google for sign-in and YouTube&apos;s API to read public channel/video stats for creators who
          connect their channel. Payment processing is handled by a third-party provider — we don&apos;t store
          full card details ourselves.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Your choices</h3>
        <p>
          You can disconnect a website or YouTube channel, or request account deletion, at any time from your
          dashboard settings.
        </p>
      </div>
    </div>
  );
}

function TermsOfUse() {
  return (
    <div className="space-y-5 text-sm text-subtle leading-relaxed">
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Using Yepper</h3>
        <p>
          You must own or have the right to list any website or channel you connect, and any ad creative you
          post must comply with the destination platform&apos;s own policies (e.g. YouTube&apos;s ad and content guidelines).
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Pricing &amp; payouts</h3>
        <p>
          Publishers set listing visibility within their assigned traffic tier; advertisers pay the listed
          price plus Yepper&apos;s margin. Payouts to publishers are released after a booking is confirmed delivered.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Prohibited use</h3>
        <p>
          No fraudulent traffic, fake subscriber/view counts, or misleading ad content. Accounts found gaming
          verification or tier placement may be suspended.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white font-(--font-display) mb-1.5">Termination</h3>
        <p>
          Either side can close their account at any time. We may suspend accounts that violate these terms,
          with notice where reasonably possible.
        </p>
      </div>
    </div>
  );
}

export default function SystemInfoPanel() {
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div className="rounded-2xl border border-border bg-surface-1 flex flex-col max-h-[calc(100vh-7rem)]">
      <div className="flex border-b border-border px-2 pt-2 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-bold rounded-t-lg transition-colors ${
              tab === t ? 'text-coral-text border-b-2 border-coral' : 'text-muted hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-5 overflow-y-auto">
        {tab !== 'Overview' && (
          <p className="mb-4 text-[11px] italic text-muted">Draft content — pending legal review.</p>
        )}
        {tab === 'Overview' && <Overview />}
        {tab === 'Privacy Policy' && <PrivacyPolicy />}
        {tab === 'Terms of Use' && <TermsOfUse />}
      </div>
    </div>
  );
}
