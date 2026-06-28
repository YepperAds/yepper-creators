'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import {
  GlobeAltIcon as OutlineGlobe,
  ChartBarIcon as OutlineChart,
  LinkIcon as OutlineLink,
  BellIcon as OutlineBell,
  Cog6ToothIcon as OutlineCog,
  QuestionMarkCircleIcon as OutlineQuestion,
  UserIcon as OutlineUser,
  ArrowLeftEndOnRectangleIcon as OutlineLogout,
  WifiIcon as OutlineWifi,
  BanknotesIcon as OutlineBanknotes,
  FireIcon as OutlineFire,
} from '@heroicons/react/24/outline';

import {
  GlobeAltIcon as SolidGlobe,
  ChartBarIcon as SolidChart,
  LinkIcon as SolidLink,
  BellIcon as SolidBell,
  Cog6ToothIcon as SolidCog,
  QuestionMarkCircleIcon as SolidQuestion,
  UserIcon as SolidUser,
  ChevronLeftIcon,
  ChevronRightIcon,
  WifiIcon as SolidWifi,
  BanknotesIcon as SolidBanknotes,
  FireIcon as SolidFire,
} from '@heroicons/react/24/solid';

import { api, AUTH_ENDPOINTS, BASE_URL } from '@/app/_lib/api';
import { useState, useEffect } from 'react';
import SettingsModal from './SettingsModal';

export default function Sidebar() {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't hijack keystrokes while user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'ArrowLeft') setCollapsed(true);
      if (e.key === 'ArrowRight') setCollapsed(false);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Fetch initial unread count and subscribe to SSE for realtime updates
  useEffect(() => {
    let es: EventSource | null = null;

    async function loadInitial() {
      try {
        const res = await api.get('/api/proxy/api/notifications?limit=1&offset=0');
        if (res.ok) {
          const payload: any = res.data;
          setUnreadCount(Number(payload?.meta?.unread ?? 0));
        }
      } catch (err) {
        console.error('Failed to load initial notifications for badge', err);
      }
    }

    loadInitial();

    try {
      es = new EventSource(`${BASE_URL}/api/notifications/stream`, { withCredentials: true });

      es.addEventListener('unread', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          setUnreadCount(Number(payload.unread ?? 0));
        } catch (err) {
          console.error('Invalid SSE unread payload', err);
        }
      });

      // If SSE fails (cross-origin cookies), fall back to polling
      let pollInterval: any = null;
      const startPolling = () => {
        if (pollInterval) return;
        pollInterval = setInterval(async () => {
          try {
            const res = await api.get('/api/proxy/api/notifications?limit=1&offset=0');
            if (res.ok) {
              const payload: any = res.data;
              setUnreadCount(Number(payload?.meta?.unread ?? 0));
            }
          } catch (err) {
            console.error('Polling notifications failed', err);
          }
        }, 15_000);
      };

      es.onerror = () => startPolling();

    } catch (err) {
      console.error('Failed to open notifications SSE', err);
      const poll = setInterval(async () => {
        try {
          const res = await api.get('/api/proxy/api/notifications?limit=1&offset=0');
          if (res.ok) {
            const payload: any = res.data;
            setUnreadCount(Number(payload?.meta?.unread ?? 0));
          }
        } catch (err) {
          console.error('Polling notifications failed', err);
        }
      }, 15_000);
      return () => clearInterval(poll);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  const isActive = (path?: string) => path ? (path === '/' ? pathname === '/' : pathname?.startsWith(path)) : false;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post(AUTH_ENDPOINTS.logout, {});
    } finally {
      // Hard navigation clears all client-side state and forces a full page reload
      // so no stale session data can remain in memory.
      window.location.href = '/login';
    }
  };

  const navGroups = [
    {
      items: [
        { label: 'Explore',          href: '/',                       icon: OutlineGlobe,     activeIcon: SolidGlobe },
        { label: 'Hot Deals',        href: '/deals',                   icon: OutlineFire,      activeIcon: SolidFire },
        { label: 'Analytics',        href: '/?panel=analytics',        icon: OutlineChart,     activeIcon: SolidChart },
        { label: 'Connect accounts', href: '/?panel=connect-accounts', icon: OutlineLink,      activeIcon: SolidLink },
        { label: 'My Profile',       href: '/?panel=profile',          icon: OutlineUser,      activeIcon: SolidUser },
      ]
    },
    {
      // Global links — accessible to both Content Creators and Web Developers
      items: [
        { label: 'Connect Website', href: '/?panel=websites', icon: OutlineWifi, activeIcon: SolidWifi },
        { label: 'Wallet',          href: '/?panel=wallet',   icon: OutlineBanknotes, activeIcon: SolidBanknotes },
      ]
    },
    {
      items: [
        { label: 'Notifications', href: '/?panel=notifications', icon: OutlineBell,     activeIcon: SolidBell },
        {
          label:      'Settings',
          icon:       OutlineCog,
          activeIcon: SolidCog,
          action:     () => setSettingsOpen(true),
        },
        {
          label:      'Help & Support',
          icon:       OutlineQuestion,
          activeIcon: SolidQuestion,
          dropdown: [
            { type: 'header', label: 'Tutorials' },
            { type: 'link',   label: 'How to connect accounts?' },
            { type: 'link',   label: 'Privacy Policy' },
            { type: 'link',   label: 'Terms' },
          ]
        },
      ]
    }
  ];

  return (
    <>
    <aside
      className={`h-screen shrink-0 border-r border-(--color-border) bg-(--color-surface-2) flex flex-col pt-6 pb-6 transition-all duration-300 ease-in-out relative z-40 ${collapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* ── Overlay for closing dropdowns ── */}
      {openDropdown && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setOpenDropdown(null)} 
        />
      )}

      {/* ── Header & Logo ── */}
      <div className={`px-4 mb-8 flex ${collapsed ? 'flex-col gap-6 items-center' : 'items-center justify-between'} relative z-40`}>
        {!collapsed ? (
          <Link href="/" className="flex items-center px-1 shrink-0 min-h-[28px]">
            {/*
            {mounted && resolvedTheme === 'dark' && (
              <Image src="/logos/logo-blacktheme.png" alt="Yepper" width={100} height={28} className="h-7 w-auto shrink-0" priority />
            )}
            {mounted && resolvedTheme !== 'dark' && (
              <Image src="/logos/logo-whitetheme.png" alt="Yepper" width={100} height={28} className="h-7 w-auto shrink-0" priority />
            )}
            */}
            <Image src="/logos/yepper-logo.png" alt="Yepper" width={100} height={28} className="h-8 w-auto shrink-0 object-contain" priority />
          </Link>
        ) : (
          <Link href="/" className="flex items-center justify-center shrink-0 min-h-[32px]">
            {/*
            {mounted && resolvedTheme === 'dark' && (
              <Image src="/logos/icon-blacktheme.png" alt="Yepper" width={32} height={32} className="w-8 h-8 shrink-0" priority />
            )}
            {mounted && resolvedTheme !== 'dark' && (
              <Image src="/logos/icon-whiteheme.png" alt="Yepper" width={32} height={32} className="w-8 h-8 shrink-0" priority />
            )}
            */}
            <Image src="/logos/yepper-logo.png" alt="Yepper" width={32} height={32} className="w-8 h-8 shrink-0 object-contain" priority />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-(--color-surface-3) text-(--color-white) transition-colors shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRightIcon className="w-5 h-5 shrink-0" /> : <ChevronLeftIcon className="w-5 h-5 shrink-0" />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className={`flex-1 space-y-6 ${collapsed ? 'px-2' : 'px-3'} relative z-40`}>
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActive(item.href) || openDropdown === item.label;
              const Icon = active ? item.activeIcon : item.icon;
              
              const ButtonOrLink = item.href ? Link : 'button';
              
              return (
                <div key={item.label} className="relative group/navitem">
                  <ButtonOrLink
                    href={item.href as string}
                    onClick={item.action ? item.action : item.dropdown ? () => setOpenDropdown(openDropdown === item.label ? null : item.label) : undefined}
                    className={`w-full relative flex items-center ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-lg text-sm font-medium transition-colors ${active
                        ? 'bg-(--color-surface-3) text-(--color-white)'
                        : 'text-(--color-white) opacity-80 hover:bg-(--color-surface-3) hover:opacity-100'
                      }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 transition-colors text-(--color-white) ${active ? 'opacity-100' : 'opacity-90'}`} />
                    
                    {!collapsed && <span className="truncate">{item.label}</span>}

                    {item.label === 'Notifications' && (
                      <span className={`flex items-center justify-center bg-(--color-coral) text-(--color-white) rounded-full font-bold ${
                        collapsed 
                          ? 'absolute top-1.5 right-1.5 w-3.5 h-3.5 text-[8px]' 
                          : 'ml-auto w-5 h-5 text-[10px]'
                      }`}>
                        {unreadCount > 0 ? String(unreadCount) : '0'}
                      </span>
                    )}

                    {!collapsed && item.dropdown && (
                      <ChevronRightIcon className={`w-3.5 h-3.5 ml-auto opacity-50 transition-transform ${openDropdown === item.label ? 'rotate-90' : ''}`} />
                    )}

                    {/* ── Custom Tooltip for Collapsed Menu ── */}
                    {collapsed && !openDropdown && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-(--color-surface-3) text-(--color-white) border border-(--color-border) text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover/navitem:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg flex items-center gap-2">
                        {item.label}
                        {item.label === 'Notifications' && <span className="px-1.5 py-0.5 bg-(--color-coral) text-white rounded-sm text-[9px]">{unreadCount > 0 ? String(unreadCount) : '0'}</span>}
                      </div>
                    )}
                  </ButtonOrLink>

                  {/* ── Flyout Menu ── */}
                  {item.dropdown && openDropdown === item.label && (
                    <div className="absolute left-full ml-3 bottom-0 bg-(--color-surface-1) border border-(--color-border) rounded-lg shadow-xl overflow-hidden py-2 min-w-[220px] animate-in fade-in slide-in-from-left-2 z-50">
                      {item.dropdown.map((subItem, idx) => {
                        if (subItem.type === 'header') {
                          return (
                            <div key={idx}>
                              {(subItem as any).divider && <div className="h-px bg-(--color-border) my-2 opacity-50" />}
                              <div className="px-4 py-1.5 flex items-center gap-1.5 text-[10px] font-bold text-(--color-muted) uppercase tracking-wider">
                                {subItem.label === 'Tutorials' && (
                                  <svg className="w-4 h-4 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.498 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                  </svg>
                                )}
                                {subItem.label}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <button key={idx} className="w-full text-left px-4 py-2 text-sm text-(--color-white) opacity-90 hover:opacity-100 hover:bg-(--color-surface-2) transition-colors flex items-center justify-between group/sub">
                            {subItem.label}
                            {/* Optional subtle arrow for sub-items similar to the screenshot */}
                            {subItem.type === 'link' && <ChevronRightIcon className="w-3 h-3 opacity-0 group-hover/sub:opacity-50 transition-opacity" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Draw a subtle separator */}
            {groupIdx < navGroups.length - 1 && (
              <div className={`h-px bg-(--color-border) my-2 opacity-60 ${collapsed ? 'mx-4' : 'mx-3'}`} />
            )}
          </div>
        ))}
      </nav>

      {/* ── Logout Button ── */}
      <div className={`pt-6 border-t border-(--color-border) mt-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`group relative w-full flex items-center ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-lg text-sm font-medium transition-colors disabled:opacity-50 text-(--color-white) opacity-80 hover:bg-(--color-surface-3) hover:opacity-100 hover:text-(--color-error)`}
        >
          <OutlineLogout className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>}

          {/* ── Custom Tooltip ── */}
          {collapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-(--color-surface-3) text-(--color-white) border border-(--color-border) text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
              Sign out
            </div>
          )}
        </button>
      </div>

    </aside>

    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
