# Yepper — Backend API Specification
### For the PHP + MySQL team

> **Stack:** PHP (hosted on Railway) · MySQL (Railway managed DB)
> **Frontend:** Next.js — communicates with your API over HTTPS
> **Auth strategy:** HTTP-only cookies (session-based)

---

## 1. CORS — Configure This First

Every single response from your PHP server must include these headers.
Without them, the browser will block **all** requests from the frontend.

```php
<?php
// ─── Put this at the very top of your entry file (index.php / bootstrap) ───

$allowed_origins = [
    'http://localhost:3000',        // Frontend dev (local)
    'https://yepper.com',           // Frontend production (update when live)
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $origin);
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, Accept");
header("Content-Type: application/json; charset=UTF-8");

// Handle browser preflight (OPTIONS) — must return 200 immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

> ⚠️ `Access-Control-Allow-Origin` **cannot be `*`** when credentials are used.
> It must be the exact frontend origin.

---

## 2. Session Cookie — Configure This Second

All authentication is handled via an **HTTP-only cookie**.
The frontend never reads or stores tokens — the browser manages the cookie automatically.

### On login success — SET the cookie:

```php
setcookie(
    'yepper_session',                    // Cookie name (must be this exact name)
    $session_token,                      // Your session token / JWT value
    [
        'expires'  => time() + 60 * 60 * 24 * 7,   // 7 days
        'path'     => '/',
        'secure'   => true,              // ✅ REQUIRED — Railway uses HTTPS
        'httponly' => true,              // ✅ REQUIRED — JS cannot read it
        'samesite' => 'None',            // ✅ REQUIRED — frontend & backend are different domains
    ]
);
```

### On logout — CLEAR the cookie:

```php
setcookie('yepper_session', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'None',
]);
```

### On protected routes — READ the cookie:

```php
$token = $_COOKIE['yepper_session'] ?? null;

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthenticated']);
    exit();
}

// Validate $token against your sessions table / JWT signature
```

---

## 3. JSON Response Format

**All responses must be JSON.** The frontend parses this exact structure.

### ✅ Success Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "advertiser"
    }
  }
}
```

### ❌ Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["The email field is required."],
    "password": ["Password must be at least 8 characters."]
  }
}
```

> **`errors`** is a `key → string[]` map where `key` = the form field name.
> The frontend automatically displays these errors under the matching input field.
> If there's no field-specific error, put a general message only in `"message"`.

### PHP Helper — send JSON response:

```php
function respond(bool $success, string $message, array $data = [], int $status = 200, array $errors = []): void {
    http_response_code($status);
    $body = ['success' => $success, 'message' => $message];
    if (!empty($data))   $body['data']   = $data;
    if (!empty($errors)) $body['errors'] = $errors;
    echo json_encode($body);
    exit();
}

// Usage examples:
respond(true,  'Login successful',   ['user' => $user]);
respond(false, 'Validation failed',  [],  422, ['email' => ['Email is required']]);
respond(false, 'Unauthenticated',    [],  401);
```

---

## 4. User Roles

There are **two user roles**. The `role` field in the user object tells the frontend where to redirect after login.

| Role | Value | Redirected to | Created by |
|---|---|---|---|
| Advertiser | `"advertiser"` | `/dashboard` | Public registration |
| Admin | `"admin"` | `/admin` | Yepper team only (no public signup) |

> Admins are created directly in the database or via an internal script.
> There is **no public admin registration endpoint.**

---

## 5. API Endpoints

Base URL: `https://your-project.up.railway.app`
All endpoints receive and return `application/json`.

---

### POST `/auth/register`

Register a new advertiser account.
**This endpoint does NOT log the user in.** It creates an unverified account and sends a 6-digit OTP to the email.
The session cookie is set only after OTP verification (`/auth/verify-email`).

**Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "password_confirmation": "secret123"
}
```

**Success `201` — OTP sent, waiting for verification:**
```json
{
  "success": true,
  "message": "Verification code sent to your email."
}
```
> ⚠️ Do **NOT** set a session cookie here. Do **NOT** return the user object yet.
> The user is not verified. Save them as unverified in the DB and send OTP.

**Error `422` — validation failed:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["This email is already registered."],
    "password": ["Password must be at least 8 characters."]
  }
}
```

---

### POST `/auth/verify-email`

Verify the OTP code sent to the user's email during registration.
This is where the session cookie gets set and the user is considered logged in.

**Request body:**
```json
{
  "email": "john@example.com",
  "otp": "847291"
}
```

**Success `200` — OTP matched, user is now verified and logged in:**
```json
{
  "success": true,
  "message": "Email verified. Welcome to Yepper!",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "advertiser"
    }
  }
}
```
> ✅ Set the session cookie here (same params as login).
> ✅ Mark `email_verified_at` in users table.
> ✅ Delete the used OTP from `email_verifications` table.

**Error `422` — wrong or expired OTP:**
```json
{
  "success": false,
  "message": "Invalid or expired verification code."
}
```

**What to do in PHP:**
1. Look up `email` + `otp` in `email_verifications` table
2. Check it hasn't expired (`expires_at > NOW()`)
3. If valid: set `email_verified_at = NOW()` on the user, delete the OTP row, create session, set cookie
4. If invalid/expired: return error

---

### POST `/auth/resend-otp`

Resend a fresh OTP to the user's email. Called when the user clicks "Resend code" (available after 60 seconds).

**Request body:**
```json
{
  "email": "john@example.com"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "A new verification code has been sent."
}
```

**What to do in PHP:**
1. Check the email belongs to an unverified account
2. Delete any existing OTP for this email in `email_verifications`
3. Generate a new 6-digit OTP, save it with `expires_at = NOW() + 5 minutes`
4. Send the OTP email
5. Return success (even if email doesn't exist — security)

---

### POST `/auth/login`

Log in with email and password.

**Request body:**
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "advertiser"
    }
  }
}
```
> Set the session cookie here.

**Error `401` — wrong credentials:**
```json
{
  "success": false,
  "message": "Invalid email or password",
  "errors": {
    "email": ["No account found with this email address."]
  }
}
```

**Error `422` — missing fields:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Email is required."],
    "password": ["Password is required."]
  }
}
```

---

### POST `/auth/logout`

Log out the current user.

**Request:** No body needed. Session cookie is read from request headers automatically.

**Success `200`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```
> Clear the session cookie in the response.

---

### GET `/auth/me`

Get the currently authenticated user. Used by the frontend on every page load to check if the user is still logged in.

**Request:** No body. Cookie is sent automatically by browser.

**Success `200`:**
```json
{
  "success": true,
  "message": "Authenticated",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "advertiser"
    }
  }
}
```

**Error `401` — not authenticated:**
```json
{
  "success": false,
  "message": "Unauthenticated"
}
```

---

### POST `/auth/forgot-password`

Send a password reset link to the user's email.

**Request body:**
```json
{
  "email": "john@example.com"
}
```

**Success `200`** *(always return success even if email doesn't exist — security best practice):*
```json
{
  "success": true,
  "message": "If this email exists, a reset link has been sent."
}
```

**Error `422`:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Please enter a valid email address."]
  }
}
```

**What to do in PHP:**
1. Check if email exists in DB
2. Generate a secure random token (store in `password_resets` table with expiry)
3. Send email with a link: `https://yepper.com/reset-password?token=THE_TOKEN`
4. Token should expire after **1 hour**

---

### POST `/auth/reset-password`

Set a new password using the token from the reset email.

**Request body:**
```json
{
  "token": "the-token-from-email",
  "password": "newpassword123",
  "password_confirmation": "newpassword123"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Error `422` — invalid or expired token:**
```json
{
  "success": false,
  "message": "This reset link is invalid or has expired.",
  "errors": {
    "token": ["This reset link is invalid or has expired."]
  }
}
```

**Error `422` — password mismatch:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "password": ["Passwords do not match."]
  }
}
```

---

## 6. Database Tables Required for Auth

Minimum tables needed to support the auth endpoints above:

```sql
-- Users table
CREATE TABLE users (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password          VARCHAR(255) NOT NULL,        -- bcrypt hashed
    role              ENUM('advertiser', 'admin') DEFAULT 'advertiser',
    email_verified_at TIMESTAMP NULL DEFAULT NULL,  -- NULL = unverified
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- OTP codes for email verification (registration step 2)
CREATE TABLE email_verifications (
    email      VARCHAR(255) NOT NULL,
    otp        VARCHAR(6) NOT NULL,               -- 6-digit code
    expires_at TIMESTAMP NOT NULL,               -- 5 minutes from creation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email)
);

-- Sessions table (for HTTP-only cookie sessions)
CREATE TABLE sessions (
    id         VARCHAR(255) PRIMARY KEY,          -- session token
    user_id    INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens
CREATE TABLE password_resets (
    email      VARCHAR(255) NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,               -- 1 hour from creation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (email),
    INDEX (token)
);
```

---

## 7. Security Requirements

| Requirement | Detail |
|---|---|
| **Password hashing** | Use `password_hash($password, PASSWORD_BCRYPT)` — never store plain text |
| **Password verify** | Use `password_verify($input, $hash)` |
| **OTP generation** | Use `str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT)` — 6-digit code |
| **OTP expiry** | 5 minutes from creation |
| **Session tokens** | Use `bin2hex(random_bytes(64))` — cryptographically secure |
| **Reset tokens** | Use `bin2hex(random_bytes(32))` — expires in 1 hour |
| **SQL queries** | Use prepared statements — never concatenate user input into SQL |
| **HTTPS** | Railway provides HTTPS by default — always use it |
| **Cookie** | `httponly=true`, `samesite=None`, `secure=true` — mandatory |

---

## 8. Testing the Connection

Once deployed on Railway, share the base URL with the frontend team:
```
https://your-project.up.railway.app
```

The frontend team will set this in their `.env.local` as:
```env
NEXT_PUBLIC_API_URL=https://your-project.up.railway.app
```

### Quick test — verify CORS is working:

```bash
curl -X OPTIONS https://your-project.up.railway.app/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Response should include:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

---
