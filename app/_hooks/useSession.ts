// ─────────────────────────────────────────────────────────────────────────────
// useSession: unified auth hook for the whole app
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the old adsense AuthContext. Checks the cookie-based session via
// /api/auth/session so every route group (advertiser, adsense) shares one
// source of truth.
//
// Returns:
//   user         : the logged-in user object, or null
//   isLoading    : true while the session check is in flight
//   isAuthenticated: true once user is confirmed
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SessionUser {
  id:         string;
  _id:        string;
  name:       string;
  email:      string;
  avatar?:    string;
  isVerified: boolean;
  role?:      string;
}

interface UseSessionReturn {
  user:            SessionUser | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  reload:          () => void;
}

export function useSession(): UseSessionReturn {
  const [user,      setUser]      = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (json?.success && json?.data?.user) {
        setUser(json.data.user as SessionUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    reload: check,
  };
}
