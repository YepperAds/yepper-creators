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
  Cog6ToothIcon as OutlineCog,
  BanknotesIcon as OutlineBanknotes,
  ArrowLeftEndOnRectangleIcon as OutlineLogout,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as SolidHome,
  FireIcon as SolidFire,
  ChartBarIcon as SolidChart,
  UserIcon as SolidUser,
  BellIcon as SolidBell,
  BanknotesIcon as SolidBanknotes,
} from '@heroicons/react/24/solid';
import SettingsModal from '@/app/(advertiser)/_components/SettingsModal';
import { useTheme, type ThemeChoice } from '@/app/_components/ThemeProvider';
import SidebarToggleIcon from './SidebarToggleIcon';

const NAV_ITEMS = [
  { label: 'Home',          panel: null,             icon: OutlineHome,      activeIcon: SolidHome },
  { label: 'Hot Deals',     panel: 'deals',          icon: OutlineFire,      activeIcon: SolidFire },
  { label: 'Wallet',        panel: 'wallet',         icon: OutlineBanknotes, activeIcon: SolidBanknotes },
  { label: 'Analytics',     panel: 'analytics',      icon: OutlineChart,     activeIcon: SolidChart },
  { label: 'Profile',       panel: 'profile',        icon: OutlineUser,      activeIcon: SolidUser },
  { label: 'Notifications', panel: 'notifications',  icon: OutlineBell,      activeIcon: SolidBell },
];

const APPEARANCE_OPTIONS: { value: ThemeChoice; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light',  label: 'Light', icon: SunIcon },
  { value: 'dark',   label: 'Dark',  icon: MoonIcon },
  { value: 'system', label: 'Auto',  icon: ComputerDesktopIcon },
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
      className={`group/navitem relative flex items-center rounded-lg text-base font-semibold text-white transition-colors ${
        collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
      } ${active ? 'bg-surface-3' : 'hover:bg-surface-3'}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}

      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-surface-3 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover/navitem:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
          {label}
        </div>
      )}
    </Link>
  );
}

// Plain row shared by the "More" popover's main list and its "Switch
// appearance" submenu — same padding/hover treatment either way.
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
  const { theme, setTheme } = useTheme();

  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  const closeMore = () => { setMoreOpen(false); setShowAppearance(false); };

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
      <aside
        className={`h-screen shrink-0 bg-background flex flex-col pt-6 pb-6 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* ── Logo + collapse toggle ── */}
        <div className={`px-4 mb-8 flex ${collapsed ? 'flex-col gap-6 items-center' : 'items-center justify-between'}`}>
          <Link href="/" className="flex items-center shrink-0 min-h-[28px]">
            <Image
              src="/logos/yepper-logo.png"
              alt="Yepper"
              width={collapsed ? 32 : 100}
              height={collapsed ? 32 : 28}
              className={collapsed ? 'w-8 h-8 object-contain' : 'h-8 w-auto object-contain'}
              priority
            />
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-white transition-colors shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <SidebarToggleIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Navigation — one flat list, centered in the space between the
            logo and the More/Help Center block pinned at the bottom ── */}
        <nav className={`flex-1 flex flex-col justify-center gap-1 ${collapsed ? 'px-2' : 'px-3'} overflow-y-auto`}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.panel);
            const Icon = active ? item.activeIcon : item.icon;
            return (
              <NavRow key={item.label} label={item.label} Icon={Icon} active={active} href={hrefFor(item.panel)} collapsed={collapsed} />
            );
          })}
        </nav>

        {/* ── More (popover) + Help Center ── */}
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
                {!showAppearance ? (
                  <>
                    <MenuRow icon={OutlineCog} label="Settings" onClick={() => { setSettingsOpen(true); closeMore(); }} />
                    <MenuRow
                      icon={MoonIcon}
                      label="Switch appearance"
                      onClick={() => setShowAppearance(true)}
                      trailing={<ChevronRightIcon className="w-3.5 h-3.5 opacity-60" />}
                    />
                    <MenuRow
                      icon={ExclamationTriangleIcon}
                      label="Report a problem"
                      onClick={() => { window.location.href = 'mailto:support@yepper.cc'; closeMore(); }}
                    />
                    <div className="h-px bg-border my-1 mx-1" />
                    <MenuRow icon={OutlineLogout} label={loggingOut ? 'Signing out…' : 'Log out'} onClick={handleLogout} />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowAppearance(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-surface-3 transition-colors text-left"
                    >
                      <ChevronLeftIcon className="w-4 h-4 shrink-0" /> Switch appearance
                    </button>
                    <div className="h-px bg-border my-1 mx-1" />
                    {APPEARANCE_OPTIONS.map((opt) => (
                      <MenuRow
                        key={opt.value}
                        icon={opt.icon}
                        label={opt.label}
                        onClick={() => { setTheme(opt.value); closeMore(); }}
                        trailing={theme === opt.value ? <CheckIcon className="w-4 h-4" /> : undefined}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setMoreOpen((o) => !o)}
              className={`w-full flex items-center rounded-lg text-base font-semibold text-white transition-colors ${
                collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
              } ${moreOpen ? 'bg-surface-3' : 'hover:bg-surface-3'}`}
            >
              <Bars3Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>More</span>}
            </button>
          </div>
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
