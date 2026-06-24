'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  HomeIcon,
  ChartBarIcon,
  MegaphoneIcon,
  UserIcon,
  BellIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  ArrowLeftEndOnRectangleIcon,
} from '@heroicons/react/24/outline';
import SettingsModal from '@/app/(advertiser)/_components/SettingsModal';

const MAIN_ITEMS = [
  { label: 'Home',      panel: null,         icon: HomeIcon },
  { label: 'Advertise', panel: 'advertise',  icon: MegaphoneIcon },
  { label: 'Wallet',    panel: 'wallet',     icon: BanknotesIcon },
];

const ACCOUNT_ITEMS = [
  { label: 'Analytics',     panel: 'analytics',     icon: ChartBarIcon },
  { label: 'Profile',       panel: 'profile',       icon: UserIcon },
  { label: 'Notifications', panel: 'notifications', icon: BellIcon },
];

function NavRow({ label, Icon, active, href }: { label: string; Icon: React.ComponentType<{ className?: string }>; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-coral text-white' : 'text-subtle hover:bg-background hover:text-white'
      }`}
    >
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-white/20' : ''}`}>
        <Icon className="w-4 h-4" />
      </span>
      {label}
    </Link>
  );
}

export default function LeftRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePanel = searchParams.get('panel');
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/login';
    }
  };

  const isActive = (panel: string | null) => pathname === '/' && activePanel === panel;
  const hrefFor = (panel: string | null) => (panel ? `/?panel=${panel}` : '/');

  return (
    <>
      <aside className="w-60 shrink-0 p-4">
        <div className="rounded-2xl border border-border bg-surface-1 p-3 sticky top-4">
          <nav className="flex flex-col gap-1">
            {MAIN_ITEMS.map((item) => (
              <NavRow key={item.label} label={item.label} Icon={item.icon} active={isActive(item.panel)} href={hrefFor(item.panel)} />
            ))}
          </nav>

          <div className="my-3 h-px bg-border" />

          <nav className="flex flex-col gap-1">
            {ACCOUNT_ITEMS.map((item) => (
              <NavRow key={item.label} label={item.label} Icon={item.icon} active={isActive(item.panel)} href={hrefFor(item.panel)} />
            ))}
          </nav>

          <div className="my-3 h-px bg-border" />

          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-subtle hover:bg-background hover:text-white transition-colors"
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                <Cog6ToothIcon className="w-4 h-4" />
              </span>
              Settings
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-subtle hover:bg-background hover:text-coral-dark transition-colors disabled:opacity-50"
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
              </span>
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </nav>
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
