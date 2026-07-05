'use client';

import { useEffect, useState } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { User } from '@/app/_types/auth';
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

export default function TopNav() {
  const [user, setUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      // Fetch session implicitly to get user details
      api.get<{ data: { user: User } }>(AUTH_ENDPOINTS.checkSession).then((res) => {
        if (res.ok && res.data?.data?.user) {
          setUser(res.data.data.user);
        }
      });
    }, 0);
  }, []);

  // Use the initials of the first name
  const initials = user?.fullname ? user.fullname.charAt(0).toUpperCase() : 'U';

  return (
    <header className="h-16 shrink-0 border-b border-(--color-border) bg-(--color-surface-2) flex items-center justify-between px-6 relative z-30">

      {/* ── Overlay for closing dropdowns ── */}
      {(profileOpen || campaignsOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => { setProfileOpen(false); setCampaignsOpen(false); }}
        />
      )}

      {/* ── Left: Search Bar ── */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center w-full">
          <MagnifyingGlassIcon className="absolute left-3 w-4 h-4 text-(--color-muted)" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-md py-2 pl-9 pr-4 text-sm text-(--color-white) placeholder-(--color-muted) focus:outline-none focus:ring-2 focus:ring-(--color-subtle) transition-all"
          />
        </div>
      </div>

      {/* ── Right: Actions & Profile ── */}
      <div className="flex items-center gap-4 relative z-40">

        {/* Manage Campaigns Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setCampaignsOpen(!campaignsOpen); setProfileOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${campaignsOpen ? 'bg-(--color-surface-3) text-(--color-white)' : 'hover:bg-(--color-surface-3) text-(--color-white)'}`}
          >
            <Squares2X2Icon className="w-5 h-5 text-(--color-muted)" />
            Manage campaigns
            <ChevronDownIcon className="w-3 h-3 text-(--color-muted)" />
          </button>

          {campaignsOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-(--color-surface-1) border border-(--color-border) rounded-lg shadow-lg py-1 animate-in fade-in slide-in-from-top-2 origin-top-right">
              <div className="px-3 py-2 text-xs font-bold text-(--color-muted) uppercase tracking-wider">
                Active Campaigns
              </div>
              <button className="w-full text-left px-4 py-2 text-sm text-(--color-white) hover:bg-(--color-surface-2) transition-colors">
                Campaign 1
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-(--color-white) hover:bg-(--color-surface-2) transition-colors">
                Campaign 2
              </button>
              <div className="h-px bg-(--color-border) my-1 mx-2 opacity-50" />
              <button className="w-full text-left px-4 py-2 text-sm text-(--color-white) hover:bg-(--color-surface-2) transition-colors flex items-center gap-2">
                <span className="text-xl leading-none">+</span> Create new
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-(--color-border) opacity-50" />

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setCampaignsOpen(false); }}
            className={`w-9 h-9 rounded-full bg-(--color-surface-3) flex items-center justify-center border border-(--color-border) transition-all overflow-hidden ${profileOpen ? 'ring-2 ring-(--color-subtle)' : 'hover:ring-2 hover:ring-(--color-subtle)'}`}
          >
            {user?.avatar && !imageError ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={user.avatar} 
                  alt={user.fullname || 'Avatar'} 
                  className="w-full h-full object-cover" 
                  onError={() => setImageError(true)}
                />
              </>
            ) : (
              <span className="text-sm font-semibold text-(--color-white)">{initials}</span>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-(--color-surface-1) border border-(--color-border) rounded-lg shadow-lg py-2 animate-in fade-in slide-in-from-top-2 origin-top-right">
              {user ? (
                <div className="px-4 py-3 border-b border-(--color-border) mb-1">
                  <p className="text-sm font-semibold text-(--color-white) truncate">{user.fullname}</p>
                  <p className="text-xs text-(--color-muted) truncate mt-0.5">{user.email}</p>
                </div>
              ) : (
                <div className="px-4 py-3 border-b border-(--color-border) mb-1">
                  <p className="text-xs text-(--color-muted) italic">Loading user data...</p>
                </div>
              )}

              <button className="w-full text-left px-4 py-2 text-sm text-(--color-white) hover:bg-(--color-surface-2) transition-colors">
                Profile Settings
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-(--color-white) hover:bg-(--color-surface-2) transition-colors">
                Edit
              </button>
            </div>
          )}
        </div>

      </div>

    </header>
  );
}
