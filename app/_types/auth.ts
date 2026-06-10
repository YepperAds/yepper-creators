// ─────────────────────────────────────────────────────────────────────────────
// Yepper — Unified Auth Types
// ─────────────────────────────────────────────────────────────────────────────
// Single auth source: backend-adsense (JWT, email/password + Google OAuth).
// The `yepper_session` cookie stores the JWT issued by the adsense backend.
// All parts of the app (advertiser panel, adsense, creators) read from here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Core user object ──────────────────────────────────────────────────────────
// Shape returned by backend-adsense GET /api/auth/me

export interface User {
  id:         string;   // UUID from the users table (also aliased as _id)
  _id?:       string;
  name:       string;
  email:      string;
  avatar?:    string;
  isVerified: boolean;
  googleId?:  string;
  createdAt?: string;
  updatedAt?: string;

  // Creators-side extended profile (populated after onboarding, may be absent)
  username?:     string;
  what_they_do?: string;
  role?:         'user' | 'admin';
}

// ── Session response (/auth/session Next.js route) ─────────────────────────────

export interface AuthResponse {
  success:  boolean;
  message?: string;
  data?: {
    user: User;
  };
}

// ── API error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  success?: false;
  message:  string;
  errors?:  Record<string, string[]>;
  requiresVerification?: boolean;
  expired?: boolean;
}

// ── Login / register response from backend-adsense ────────────────────────────

export interface LoginResponse {
  success:             boolean;
  token?:              string;
  user?:               User;
  message?:            string;
  requiresVerification?: boolean;
  maskedEmail?:        string;
}

export interface RegisterResponse {
  success:             boolean;
  requiresVerification?: boolean;
  maskedEmail?:        string;
  message?:            string;
}

// ── Username check (creators onboarding) ─────────────────────────────────────

export interface UsernameCheckResponse {
  available: boolean;
  reason:    string;
}
