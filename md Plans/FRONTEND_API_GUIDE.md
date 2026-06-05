# Yepper Backend API Guide for Frontend Integration

Welcome! This guide explains how to connect your Next.js frontend to the Yepper PHP Authentication Backend.

> [!IMPORTANT]
> **CORS & Cookies:** The backend uses standard PHP sessions (cookies) to maintain authentication state. **Every single request** you make from the frontend (using `fetch` or `axios`) **MUST** include credentials so the session cookie is passed along.

**If using `fetch`:**
```javascript
fetch('https://your-backend.railway.app/auth/endpoint.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // <--- CRITICAL
  body: JSON.stringify(data)
})
```

**If using `axios`:**
```javascript
import axios from 'axios';
axios.defaults.withCredentials = true; // <--- CRITICAL
```

---

## 1. Registration (`/auth/register.php`)
Creates a new unverified account and emails a 6-digit OTP instantly.

- **Method:** `POST`
- **Body:**
  ```json
  {
    "fullname": "John Doe",
    "email": "john@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Responses:**
  - `201 Created`: Success. Sends an OTP email. Route the user to the OTP Verification screen.
  - `400 Bad Request`: Validation errors (e.g. weak password, invalid email).
  - `409 Conflict`: Email already exists. If the user exists but is unverified, the response includes `"requires_verification": true`.

## 2. Verify OTP (`/auth/verify_otp.php`)
Verifies the account using the OTP sent to the user's email. **This also logs the user in automatically.**

- **Method:** `POST`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "otp_code": "123456"
  }
  ```
- **Responses:**
  - `200 OK`: OTP is valid. User status changes to 'verified' and a session cookie is set. Route user to Dashboard.
  - `400 Bad Request`: Invalid OTP, or OTP has expired.
  - `404 Not Found`: Email not found.

## 3. Login (`/auth/login.php`)
Logs the user in. If the user exists but is not verified yet, it automatically sends a *new* OTP and rejects the login.

- **Method:** `POST`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Responses:**
  - `200 OK`: Login successful. A session cookie is set. Route user to Dashboard.
  - `401 Unauthorized`: Invalid credentials.
  - `403 Forbidden`: Account is unverified. The backend automatically emailed a new OTP. `requires_verification: true` is returned. Route user to OTP Verification screen.

## 4. Send / Resend OTP (`/auth/send_otp.php`)
Can be used to resend an OTP if the previous one expired, or to start the Forgot Password flow. *Note: this endpoint is rate-limited to 1 request per minute per user.*

- **Method:** `POST`
- **Body:**
  ```json
  {
    "email": "john@example.com"
  }
  ```
- **Responses:**
  - `200 OK`: OTP sent to email.
  - `404 Not Found`: Email doesn't exist.
  - `429 Too Many Requests`: User requested an OTP less than a minute ago. Response includes `"retry_after": seconds`.

## 5. Reset Password (`/auth/reset_password.php`)
Used to change a forgotten password. Requires the user to request an OTP (via `/auth/send_otp.php` above) first.

- **Method:** `POST`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "otp_code": "123456",
    "new_password": "NewStrongPassword123!"
  }
  ```
- **Responses:**
  - `200 OK`: Password updated successfully. (The user still needs to go to the Login screen afterwards).
  - `400 Bad Request`: Invalid OTP or weak new password.

## 6. Check Session / Get Profile (`/auth/check_session.php`)
Returns the currently logged-in user's data. Call this on frontend initial load to check if the user is authenticated.

- **Method:** `GET`
- **Responses:**
  - `200 OK`: User is logged in. Returns user data.
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "user_uuid": "...",
          "fullname": "John Doe",
          "email": "john@example.com",
          "status": "verified"
        }
      }
    }
    ```
  - `401 Unauthorized`: User is not logged in. Redirect them to login.

## 7. Logout (`/auth/logout.php`)
Clears the session cookie on the server.

- **Method:** `POST` *(or `OPTIONS` for preflight)*
- **Responses:**
  - `200 OK`: Logged out successfully. Clear any frontend state and route to login.
