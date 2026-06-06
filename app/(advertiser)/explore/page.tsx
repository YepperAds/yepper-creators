import Link from 'next/link';
import {
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
  MegaphoneIcon,
  UserIcon,
  Squares2X2Icon,
  BoltIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const modules = [
  {
    title: 'Connect accounts',
    description: 'Connect social media accounts to show analytics and insights.',
    href: '/connect-accounts',
    icon: Squares2X2Icon,
  },
  {
    title: 'Analytics',
    description: 'View connected account insights and recent posts.',
    href: '/analytics',
    icon: ChartBarIcon,
  },
  {
    title: 'Profile',
    description: 'Update your profile and onboarding information.',
    href: '/profile',
    icon: UserIcon,
  },
];

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--color-white)]">Launchpad</h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-muted)]">
            Access all features for Yepper creators in one place. Connect accounts, view analytics, and manage your profile to get the most out of your Yepper experience.
          </p>
        </div>

        <Link href="/connect-accounts" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black">
          Connect social accounts
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
    </div>
  );
}
