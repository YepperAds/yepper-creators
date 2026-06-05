// ─────────────────────────────────────────────────────────────────────────────
// Yepper Creators — Auth Type Definitions
// ─────────────────────────────────────────────────────────────────────────────
// Google-only auth. All interfaces mirror the exact shapes
// returned by the Node.js backend.
// ─────────────────────────────────────────────────────────────────────────────

// ── Creator user object (from /auth/session response) ─────────────────────────

export interface User {
  user_uuid:    string;
  id:           string;
  google_id:    string;
  fullname:     string;
  email:        string;

  // Onboarding fields (undefined until onboarding is complete)
  username?:     string;
  what_they_do?: string;
  website?: {
    name?: string;
    url?: string;
    domain?: string;
    status?: 'not_connected' | 'pending_verification' | 'site_unreachable' | 'verified';
    icon?: string;
    traffic?: Record<string, unknown>;
    verified_at?: string;
  };

  avatar?:  string;
  status:   'verified' | 'unverified';
  role?:    'creator' | 'admin';
}

// ── Response shapes ───────────────────────────────────────────────────────────

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
  };
}

export interface ApiError {
  success?: false;
  message: string;
  errors?: Record<string, string[]>;
}

// ── Username availability response ────────────────────────────────────────────

export interface UsernameCheckResponse {
  available: boolean;
  reason:    string;
}
