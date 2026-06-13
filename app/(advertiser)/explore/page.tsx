'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  UserIcon,
  Squares2X2Icon,
  WifiIcon,
  BanknotesIcon,
  ComputerDesktopIcon,
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

export default function ExplorePage() {
  const [user, setUser] = useState<{ name?: string; fullname?: string; fullName?: string; what_they_do?: string; whatTheyDo?: string } | null>(null);

  useEffect(() => {
    api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession).then((res) => {
      if (res.ok && res.data?.data?.user) setUser(res.data.data.user as any);
    });
  }, []);

  const displayName = user?.fullname || user?.fullName || user?.name || '';
  const firstName   = displayName.split(' ')[0] || '';
  const role        = user?.what_they_do || user?.whatTheyDo || '';

  const modules = [
    {
      title:       'Connect accounts',
      description: 'Connect social media accounts to show analytics and insights.',
      href:        '/connect-accounts',
      icon:        Squares2X2Icon,
    },
    {
      title:       'Analytics',
      description: 'View connected account insights and recent posts.',
      href:        '/analytics',
      icon:        ChartBarIcon,
    },
    {
      title:       'Profile',
      description: 'Update your profile and onboarding information.',
      href:        '/profile',
      icon:        UserIcon,
    },
  ];

  const globalModules = [
    {
      title:       'Connect Website',
      description: 'Verify and connect your website to start tracking traffic and serving ads.',
      href:        '/connect-website',
      icon:        WifiIcon,
      accent:      true,
    },
    {
      title:       'Wallet',
      description: 'View your Yepper balance, earnings, and withdrawal history.',
      href:        '/wallet',
      icon:        BanknotesIcon,
      accent:      true,
    },
  ];

  const adsenseModules = [
    {
      title:       'Web Promoter',
      description: 'Manage your websites, ad spaces, categories, and earnings as a publisher.',
      href:        '/connect-website',
      icon:        ComputerDesktopIcon,
    },
    {
      title:       'Ad Owner',
      description: 'Create and manage ad campaigns, select placements, and track performance.',
      href:        '/ad-owner/pages/ads',
      icon:        RectangleGroupIcon,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--color-white)]">
            {firstName ? `Hey, ${firstName} 👋` : 'Launchpad'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-muted)]">
            {role
              ? `Welcome back${role === 'Content Creator' ? ', Creator' : role === 'Web Developer' ? ', Developer' : ''}. Here's everything you need to grow on Yepper.`
              : 'Access all Yepper features in one place.'}
          </p>
        </div>
        <Link
          href="/connect-accounts"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black shrink-0"
        >
          Connect social accounts
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Core modules */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.title}
              href={module.href}
              className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] p-5 transition-colors hover:bg-[color:var(--color-surface-2)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <Icon className="h-5 w-5 text-[color:var(--color-white)]" />
                </div>
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-[color:var(--color-muted)]" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-[color:var(--color-white)]">{module.title}</h2>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">{module.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Global tools — Connect Website + Wallet (both roles) */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[color:var(--color-white)]">Your Yepper Tools</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Available to all creators — manage your website and earnings in one place.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {globalModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group relative rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] p-5 transition-colors hover:bg-[color:var(--color-surface-2)] hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] group-hover:border-white/20">
                    <Icon className="h-5 w-5 text-[color:var(--color-white)]" />
                  </div>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-[color:var(--color-muted)]" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-[color:var(--color-white)]">{module.title}</h2>
                <p className="mt-2 text-sm text-[color:var(--color-muted)]">{module.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Yepper Adsense */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[color:var(--color-white)]">Yepper Adsense</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Monetize your website or run ad campaigns directly on the Yepper network.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {adsenseModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group relative rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] p-5 transition-colors hover:bg-[color:var(--color-surface-2)] hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] group-hover:border-white/20">
                    <Icon className="h-5 w-5 text-[color:var(--color-white)]" />
                  </div>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-[color:var(--color-muted)]" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-[color:var(--color-white)]">{module.title}</h2>
                <p className="mt-2 text-sm text-[color:var(--color-muted)]">{module.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
