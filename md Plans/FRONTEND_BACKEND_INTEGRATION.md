# Yepper — Frontend ↔ Backend Integration Guide

## Overview

```
Browser (Next.js)  ──HTTPS──▶  PHP on Railway  ──SQL──▶  MySQL on Railway
  localhost:3000          https://xyz.up.railway.app       (Railway internal)
  or yepper.com
```

The backend team hosts both PHP and MySQL on **Railway**. Your frontend talks to the Railway URL directly over HTTPS — in local development **and** in production.

---

## Environment Setup

### 1. Get the Railway URL from the backend team

They will give you a URL like:
```
https://yepper-backend-production.up.railway.app
```

### 2. Set it in `.env.local`

```env
NEXT_PUBLIC_API_URL=https://yepper-backend-production.up.railway.app
```

### 3. Restart the dev server

```bash
# Stop the server (Ctrl+C) then:
npm run dev
```

That's it. No other code changes needed — `app/_lib/api.ts` reads this automatically.

---

## How Every Request Works

```
1.  User fills login form → clicks "Sign in"

2.  LoginForm.tsx  →  apiFetch('/auth/login', { method: 'POST', body: ... })

3.  apiFetch builds:
        https://yepper-backend-production.up.railway.app/auth/login

4.  Browser sends HTTPS request to Railway server
    (with  credentials: 'include'  so cookies are attached)

5.  PHP processes → queries MySQL → returns JSON response

6.  PHP sets HTTP-only cookie in response headers

7.  Browser stores cookie (JS cannot read it — secure by design)

8.  Frontend reads JSON → redirects user to /dashboard

9.  Every future request auto-sends the cookie  ← managed by browser
```

---

## ⚠️ Cross-Origin Cookie Rules (Railway-Specific)

This is the most important section. Because your frontend and backend are on **different domains**, the browser enforces strict cross-origin cookie rules.

### The Problem

```
Frontend:  http://localhost:3000        (or https://yepper.com)
Backend:   https://xyz.up.railway.app  ← DIFFERENT domain
```

Browsers block cookies set across different domains by default.

### The Fix — Backend Team MUST do this

The PHP backend on Railway must set cookies exactly like this:

```php
setcookie(
    'yepper_session',
    $session_token,
    [
        'expires'  => time() + 60 * 60 * 24 * 7,
        'path'     => '/',
        'secure'   => true,        // ✅ REQUIRED for cross-origin (Railway is HTTPS)
        'httponly' => true,        // ✅ JS cannot read the cookie
        'samesite' => 'None',      // ✅ REQUIRED for cross-origin requests
    ]
);
```

> **`SameSite=None` + `Secure=true` is mandatory** when frontend and backend
> are on different domains. Without this, the cookie is silently blocked
> by the browser and the user appears logged out on every page refresh.

### Required CORS Headers (every PHP response)

```php
$frontend_url = 'http://localhost:3000'; // change to https://yepper.com in production

header("Access-Control-Allow-Origin: " . $frontend_url);
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, Accept");

// Handle preflight (browser sends OPTIONS before real request)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

> ⚠️ `Access-Control-Allow-Origin` must be the **exact URL with no trailing slash**.
> Wildcards (`*`) will NOT work when `Allow-Credentials: true` is set.

---

## Development Scenarios

### Scenario A — Using Railway backend locally (recommended now)

```
Your machine: npm run dev  →  localhost:3000
              .env.local   →  NEXT_PUBLIC_API_URL=https://xyz.up.railway.app
```

- The PHP team deploys to Railway once
- You point your local frontend at their Railway URL
- ✅ Works without anyone running PHP locally

### Scenario B — Both running locally (optional)

```
Your machine: npm run dev  →  localhost:3000
Backend dev:  php -S localhost:8000  (on their machine or yours)
.env.local    →  NEXT_PUBLIC_API_URL=http://localhost:8000
```

- Requires backend dev to share their machine or both set up PHP

### Scenario C — Both deployed (production)

```
Frontend deployed (Vercel/Netlify/etc.)  →  https://yepper.com
Backend deployed (Railway)               →  https://api.yepper.com (custom domain)
.env.production  →  NEXT_PUBLIC_API_URL=https://api.yepper.com
```

---

## Expected API Response Format

### ✅ Success

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "advertiser"
    }
  },
  "message": "Login successful"
}
```

### ❌ Error

```json
{
  "success": false,
  "message": "Invalid credentials",
  "errors": {
    "email": ["No account found with this email"],
    "password": ["Password is incorrect"]
  }
}
```

---

## Auth Endpoints the Frontend Calls

| Endpoint | Method | Called from | Purpose |
|---|---|---|---|
| `/auth/login` | POST | `LoginForm.tsx` | Email + password login |
| `/auth/register` | POST | `RegisterForm.tsx` | New advertiser account |
| `/auth/forgot-password` | POST | `ForgotPasswordForm.tsx` | Send reset email |
| `/auth/reset-password` | POST | `ResetPasswordForm.tsx` | Set new password with token |
| `/auth/logout` | POST | *(to be built)* | Clear session cookie |
| `/auth/me` | GET | *(to be built)* | Get current user from cookie |

---

## Integration Checklist

### Your side (Frontend)

- [ ] Get Railway URL from backend team
- [ ] Update `NEXT_PUBLIC_API_URL` in `.env.local`
- [ ] Restart `npm run dev`

### Backend team side (PHP on Railway)

- [ ] PHP server running and accessible on Railway URL
- [ ] MySQL connected on Railway
- [ ] `Access-Control-Allow-Origin` = exact frontend URL (no wildcard)
- [ ] `Access-Control-Allow-Credentials: true` on every response
- [ ] `OPTIONS` preflight requests return `200`
- [ ] Cookie set with `SameSite=None; Secure=true; HttpOnly=true`
- [ ] JSON responses match the format above (`success`, `data`, `errors`)

---

## Common Errors & Fixes

| Error in browser | Cause | Fix |
|---|---|---|
| `CORS error` | PHP missing CORS headers | Backend adds `Access-Control-Allow-Origin` |
| `Credentials flag` blocking request | Missing `Allow-Credentials` header | Backend adds `Access-Control-Allow-Credentials: true` |
| Cookie set but lost on next request | `SameSite` not `None` or `Secure` not `true` | Fix `setcookie()` params in PHP |
| `Network Error` / connection refused | Wrong Railway URL or backend down | Verify URL in `.env.local`, check Railway dashboard |
| Form shows no field errors | `errors` key missing in JSON | PHP must return `errors: { field: [messages] }` |
| Login works but user logged out on refresh | Cookie not persisting | Set `SameSite=None; Secure=true` in PHP cookie |
