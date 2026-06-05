// ─────────────────────────────────────────────────────────────
// Yepper — Base API Client
// ─────────────────────────────────────────────────────────────
// All backend requests go through this module.
//
// KEY DECISIONS:
//   • credentials: 'include'  → sends & receives HTTP-only cookies
//                               (the PHP backend manages the session/JWT
//                                via Set-Cookie, so we never touch tokens
//                                in JS land)
//   • Content-Type: json      → PHP backend expects JSON bodies
//
// To switch base URL: update NEXT_PUBLIC_API_URL in .env.local
// ─────────────────────────────────────────────────────────────

import type { ApiError } from '@/app/_types/auth';

// Use same-origin API routes so the frontend no longer points at an external backend.
// This keeps the UI code unchanged but routes requests to local Next.js API handlers.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// ── Generic response wrapper ───────────────────────────────────

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

// ── Core request helper ────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${path}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    const res = await fetch(url, {
      ...options,
      cache: 'no-store', // Prevent session/API responses from being cached
      signal: controller.signal,
      credentials: 'include', // HTTP-only cookie auth
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: json as ApiError };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      error: {
        message: isTimeout
          ? 'Request timed out. The server took too long to respond.'
          : 'Network error. Please check your connection.',
      },
    };
  }
}

// ── Convenience methods ────────────────────────────────────────

export const api = {
  post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  get<T>(path: string): Promise<ApiResult<T>> {
    return request<T>(path, { method: 'GET' });
  },

  delete<T>(path: string): Promise<ApiResult<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
};

// ── Auth-specific endpoints ────────────────────────────────────
// Import these in form components instead of calling api.post directly.
// Swap the path strings here when the PHP routes change.

export const AUTH_ENDPOINTS = {
  checkSession:  '/auth/session',        // GET (backend OAuth server)
  logout:        '/auth/logout',          // POST — backend logout
  exchangeToken: '/api/auth/exchange-token',  // POST — Google OAuth token → session
} as const;

// ── Social / Connect-Accounts endpoints ───────────────────────
export const SOCIAL_ENDPOINTS = {
  // OAuth initiation (via proxy to avoid SameSite cookie issues)
  connect: (provider: string, userUuid: string) =>
    `/api/connect/${provider}?user_uuid=${userUuid}`,

  // All connected accounts for the logged-in user
  stats: (userUuid: string) =>
    `/api/social/stats?user_uuid=${userUuid}`,

  // Last 5 posts / videos for a specific platform
  videoStats: (provider: string, userUuid: string) =>
    `/api/social/video-stats?provider=${provider}&user_uuid=${userUuid}`,

  // 28-day chart analytics for a specific platform
  insights: (provider: string, userUuid: string) =>
    `/api/social/insights?provider=${provider}&user_uuid=${userUuid}`,
} as const;
