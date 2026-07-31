'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'dark' | 'light';
type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'yepper-theme';

// Routes that are always dark regardless of the user's theme choice: the
// auth flow and the public marketing site were designed dark-only and never
// got themed. `/` is ambiguous: it's the marketing homepage for guests but
// the real dashboard for logged-in users, so it only counts as "always
// dark" when there's no session, checked via `yepper_token`, the
// non-httpOnly mirror of the session cookie (see app/api/auth/dev-login).
// Keep this list and the equivalent string in ThemeScript below in sync.
const ALWAYS_DARK_PATHS = ['/login', '/onboarding', '/privacy', '/terms'];

function isForceDarkRoute(pathname: string): boolean {
  if (ALWAYS_DARK_PATHS.includes(pathname)) return true;
  if (pathname === '/') return !document.cookie.includes('yepper_token=');
  return false;
}

function systemPrefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches;
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') return systemPrefersLight() ? 'light' : 'dark';
  return choice;
}

// Only ever stamps `data-theme` on force-dark routes if it's already
// missing; never flips it to "light", since the base :root is dark by
// default and that's exactly what these routes want.
function apply(resolved: ResolvedTheme) {
  if (isForceDarkRoute(window.location.pathname)) return;
  document.documentElement.setAttribute('data-theme', resolved);
}

// Inline, synchronous, runs before paint; keeps a returning light-mode user
// from seeing a flash of the dark-mode default while React hydrates.
export function ThemeScript() {
  const code = `(function(){try{var p=window.location.pathname;var always=['/login','/onboarding','/privacy','/terms'];var forced=always.indexOf(p)!==-1||(p==='/'&&document.cookie.indexOf('yepper_token=')===-1);if(forced)return;var s=localStorage.getItem('${STORAGE_KEY}')||'dark';var r=s==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):s;document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

const ThemeContext = createContext<{
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemeChoice) => void;
} | null>(null);

// SSR renders with no localStorage, so these only run client-side (lazy
// useState initializers execute on both, guarded below), but by the time
// this component itself is client-rendered, ThemeScript has already
// stamped data-theme on <html>, so reading localStorage straight from the
// initializer just brings React state in sync with what's already on
// screen. Neither value affects markup during hydration, so there's no
// server/client mismatch to worry about.
function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    typeof window === 'undefined' ? 'dark' : resolve(readStoredTheme())
  );

  // Track OS-level changes while the user is on "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const next = resolve('system');
      setResolvedTheme(next);
      apply(next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    const resolved = resolve(next);
    setResolvedTheme(resolved);
    apply(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
