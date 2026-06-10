# Unified Auth System

## How it works

```
User (browser)
  │
  ├─ Email/password login  →  POST /api/auth/login  (Next.js proxy)
  │                               │
  │                               └─ POST http://localhost:5001/api/auth/login
  │                                      │ returns { token, user }
  │                                      │
  │                               Sets yepper_session=JWT (HTTP-only cookie)
  │
  ├─ Google OAuth          →  GET /api/auth/google  (Next.js route)
  │                               │
  │                               └─ Redirects to Google → callback
  │                                  POST /api/auth/google-exchange (adsense backend)
  │                                      │ upserts user, returns JWT
  │                               Sets yepper_session=JWT (HTTP-only cookie)
  │
  └─ Session check         →  GET /auth/session  (Next.js route)
                                   │
                                   └─ GET http://localhost:5001/api/auth/me
                                          (with Bearer ${yepper_session cookie})
                                          returns { success, user }
```

## Single source of truth

**`backend-adsense`** (`server2`) is the single auth backend:
- Stores users in the PostgreSQL `users` table
- Issues 7-day JWTs
- Handles email/password, email verification, password reset, Google OAuth

The `yepper_session` cookie holds the JWT. All Next.js routes and the
creators panel read auth state via `GET /auth/session`.

## Files changed from originals

| File | What changed |
|---|---|
| `app/api/auth/session/route.ts` | Verifies JWT with adsense backend instead of querying `businesses` table |
| `app/api/auth/login/route.ts` | **New** — proxies to adsense backend, sets cookie |
| `app/api/auth/register/route.ts` | **New** — proxies to adsense backend |
| `app/api/auth/google/callback/route.ts` | Calls adsense `/api/auth/google-exchange` instead of upserting `businesses` |
| `app/api/auth/verify-email/route.ts` | **New** — catches adsense email-verify redirect, sets cookie |
| `app/api/auth/forgot-password/route.ts` | **New** — proxies to adsense backend |
| `app/_components/auth/ProtectedRoute.tsx` | Removed onboarding check (username/what_they_do) |
| `app/_components/auth/AuthGuard.tsx` | Removed onboarding check |
| `app/_components/auth/LoginForm.tsx` | Added email/password form alongside Google |
| `app/_components/auth/RegisterForm.tsx` | **New** — full registration form |
| `app/_types/auth.ts` | Merged User type from both systems |
| `backend-adsense/controllers/authController.js` | Added `googleExchange` endpoint |
| `backend-adsense/routes/authRoutes.js` | Added `/google-exchange` route |
| `app/_lib/adsense-api.ts` | Removed localStorage token reads |

## What is NOT changed

- The creators panel's ProtectedRoute and AuthGuard call sites are identical
- The `(advertiser)` layout uses ProtectedRoute — works unchanged
- The `(adsense)` layout uses its own auth — now shares the same cookie

## .env.local required keys

```
ADSENSE_BACKEND_URL=http://localhost:5001
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Set `FRONTEND_URL=http://localhost:3000` in `backend-adsense/.env` so email
verification links point to your Next.js app.
