// ─────────────────────────────────────────────────────────────────────────────
// Next.js API Route: GET /auth/session
// ─────────────────────────────────────────────────────────────────────────────
// Unified session check for the entire app (creators panel + adsense).
//
// MIGRATION from yepper-creators original:
//   [CHANGED] No longer queries the local `businesses` PostgreSQL table.
//   [CHANGED] Reads the JWT from the `yepper_session` cookie (set at login).
//   [CHANGED] Verifies the JWT with the adsense backend (GET /api/auth/me)
//             so there is a single source of truth for the user object.
//   [KEPT]    Same response shape { success, data: { user } } so all existing
//             ProtectedRoute / AuthGuard calls continue to work without change.
//
// Flow:
//   1. Read `yepper_session` cookie (contains the JWT from backend-adsense)
//   2. Forward it to backend-adsense /api/auth/me as Bearer token
//   3. Map the response to the unified User shape and return it
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API =
  process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('yepper_session')?.value;

  if (!token) {
    return NextResponse.json({ success: false, message: 'No session' }, { status: 200 });
  }

  try {
    const upstream = await fetch(`${ADSENSE_API}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Don't cache — auth responses must always be fresh
      cache: 'no-store',
    });

    if (!upstream.ok) {
      // Token expired or invalid — tell the client to log out
      const res = NextResponse.json(
        { success: false, message: 'Session expired' },
        { status: 200 },
      );
      // Clear the stale cookie
      res.cookies.set('yepper_session', '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

    const json = (await upstream.json()) as {
      success: boolean;
      user?: {
        id: string;
        _id?: string;
        name: string;
        email: string;
        avatar?: string;
        isVerified: boolean;
        googleId?: string;
        createdAt?: string;
        updatedAt?: string;
      };
    };

    if (!json.success || !json.user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 200 });
    }

    const u = json.user;

    // Return in the unified AuthResponse shape so ProtectedRoute / AuthGuard
    // keep working with zero changes to their call sites.
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id:         u.id ?? u._id,
          _id:        u.id ?? u._id,
          // user_uuid mirrors id — kept for backwards compatibility with social connect flow
          user_uuid:  (u as any).user_uuid ?? u.id ?? u._id,
          name:       u.name,
          email:      u.email,
          avatar:     u.avatar,
          isVerified: u.isVerified,
          googleId:   u.googleId,
          createdAt:  u.createdAt,
          updatedAt:  u.updatedAt,
          // role defaults — can be extended later
          role:       'user',
          // Creator fields (if present)
          username:   (u as any).username ?? undefined,
          whatTheyDo: (u as any).what_they_do ?? (u as any).whatTheyDo ?? undefined,
          what_they_do: (u as any).what_they_do ?? (u as any).whatTheyDo ?? undefined,
          // Backwards-compatible fullname variants used across the frontend
          fullName:   (u as any).full_name ?? (u as any).fullName ?? u.name ?? undefined,
          fullname:   (u as any).full_name ?? (u as any).fullName ?? u.name ?? undefined,
        },
      },
    });
  } catch {
    // Network error reaching the adsense backend — don't log user out,
    // surface as a retryable error (ProtectedRoute handles this gracefully)
    return NextResponse.json(
      { success: false, message: 'Could not reach auth server' },
      { status: 503 },
    );
  }
}
