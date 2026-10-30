'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  HomeIcon as OutlineHome,
  FireIcon as OutlineFire,
  ChartBarIcon as OutlineChart,
  UserIcon as OutlineUser,
  BellIcon as OutlineBell,
  BanknotesIcon as OutlineBanknotes,
  MegaphoneIcon as OutlineMegaphone,
  GlobeAltIcon as OutlineGlobe,
  FilmIcon as OutlineFilm,
  ArrowLeftEndOnRectangleIcon as OutlineLogout,
  Bars3Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as SolidHome,
  FireIcon as SolidFire,
  ChartBarIcon as SolidChart,
  UserIcon as SolidUser,
  BellIcon as SolidBell,
  BanknotesIcon as SolidBanknotes,
  MegaphoneIcon as SolidMegaphone,
  GlobeAltIcon as SolidGlobe,
  FilmIcon as SolidFilm,
} from '@heroicons/react/24/solid';
import SidebarToggleIcon from './SidebarToggleIcon';

const NAV_ITEMS = [
  { label: 'Home',          panel: null,             icon: OutlineHome,      activeIcon: SolidHome },
  { label: 'Ads',           panel: 'ads',            icon: OutlineMegaphone, activeIcon: SolidMegaphone },
  { label: 'Websites',      panel: 'websites',       icon: OutlineGlobe,     activeIcon: SolidGlobe },
  { label: 'Social Media',  panel: 'youtube',        icon: OutlineFilm,      activeIcon: SolidFilm },
  { label: 'Hot Deals',     panel: 'deals',          icon: OutlineFire,      activeIcon: SolidFire },
  { label: 'Wallet',        panel: 'wallet',         icon: OutlineBanknotes, activeIcon: SolidBanknotes },
  { label: 'Analytics',     panel: 'analytics',      icon: OutlineChart,     activeIcon: SolidChart },
  { label: 'Profile',       panel: 'profile',        icon: OutlineUser,      activeIcon: SolidUser },
  { label: 'Notifications', panel: 'notifications',  icon: OutlineBell,      activeIcon: SolidBell },
];

function NavRow({
  label, Icon, active, href, collapsed,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  href: string;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`group/navitem relative flex items-center rounded-lg text-base font-semibold text-white transition-[gap,padding,background-color] delay-300 duration-300 ease-in-out ${
        collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5'
      } ${active ? 'bg-surface-3' : 'hover:bg-surface-3'}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span
        aria-hidden={collapsed}
        className={`overflow-hidden whitespace-nowrap ease-in-out ${
          collapsed
            ? 'max-w-0 -translate-x-1 opacity-0 transition-[max-width,opacity,transform] duration-300'
            : 'max-w-40 translate-x-0 opacity-100 transition-[max-width,opacity,transform] delay-300 duration-200'
        }`}
      >
        {label}
      </span>

      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-surface-3 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover/navitem:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
          {label}
        </div>
      )}
    </Link>
  );
}

// Plain row shared by the "More" popover's main list and its "Switch
// appearance" submenu, same padding/hover treatment either way.
function MenuRow({
  icon: Icon, label, onClick, trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-white opacity-90 hover:opacity-100 hover:bg-surface-3 transition-colors text-left"
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export default function LeftRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePanel = searchParams.get('panel');

  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const closeMore = () => setMoreOpen(false);

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
      <aside
        className={`h-screen shrink-0 bg-background flex flex-col pt-6 pb-6 transition-[width] duration-500 ease-in-out will-change-[width] ${
          collapsed ? 'w-20 delay-300' : 'w-64'
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className={`px-4 mb-8 flex ${collapsed ? 'justify-center' : 'items-center justify-between'}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="group relative flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Image
                src="/logos/yepper-logo.png"
                alt=""
                width={32}
                height={32}
                priority
                className="h-8 w-8 object-contain transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
              />
              <span className="absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <SidebarToggleIcon className="h-5 w-5" />
              </span>
            </button>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <Link href="/" className="flex min-h-[28px] shrink-0 items-center">
                <Image
                  src="/logos/yepper-logo.png"
                  alt="Yepper"
                  width={100}
                  height={28}
                  priority
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setCollapsed(true)}
                className="shrink-0 rounded-lg p-1.5 text-white transition-colors hover:bg-surface-3"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <SidebarToggleIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation: one flat list, centered in the space between the
            logo and the More/Help Center block pinned at the bottom */}
        <nav className={`flex-1 flex flex-col justify-center gap-1 ${collapsed ? 'px-2' : 'px-3'} overflow-y-auto`}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.panel);
            const Icon = active ? item.activeIcon : item.icon;
            return (
              <NavRow key={item.label} label={item.label} Icon={Icon} active={active} href={hrefFor(item.panel)} collapsed={collapsed} />
            );
          })}
        </nav>

        {/* More (popover) + Help Center */}
        <div className={`pt-2 mt-auto ${collapsed ? 'px-2' : 'px-3'} flex flex-col gap-1 relative`}>
          {moreOpen && (
            <div className="fixed inset-0 z-40" onClick={closeMore} />
          )}

          <div className="relative">
            {moreOpen && (
              <div
                className={`absolute bottom-full mb-2 z-50 rounded-xl bg-surface-2 shadow-xl p-1.5 ${
                  collapsed ? 'left-1/2 -translate-x-1/2 w-56' : 'left-0 right-0'
                }`}
              >
                {/* Report a problem, hidden for now, not commented out of
                    existence: re-enable by uncommenting this MenuRow.
                <MenuRow
                  icon={ExclamationTriangleIcon}
                  label="Report a problem"
                  onClick={() => { window.location.href = 'mailto:support@yepper.cc'; closeMore(); }}
                /> */}
                <MenuRow icon={OutlineLogout} label={loggingOut ? 'Signing out…' : 'Log out'} onClick={handleLogout} />
              </div>
            )}

            <button
              onClick={() => setMoreOpen((o) => !o)}
              className={`w-full flex items-center rounded-lg text-base font-semibold text-white transition-[gap,padding,background-color] delay-300 duration-300 ease-in-out ${
                collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5'
              } ${moreOpen ? 'bg-surface-3' : 'hover:bg-surface-3'}`}
            >
              <Bars3Icon className="w-5 h-5 shrink-0" />
              <span
                aria-hidden={collapsed}
                className={`overflow-hidden whitespace-nowrap ease-in-out ${
                  collapsed
                    ? 'max-w-0 -translate-x-1 opacity-0 transition-[max-width,opacity,transform] duration-300'
                    : 'max-w-40 translate-x-0 opacity-100 transition-[max-width,opacity,transform] delay-300 duration-200'
                }`}
              >
                More
              </span>
            </button>
          </div>
        </div>
      </aside>
  );
}
