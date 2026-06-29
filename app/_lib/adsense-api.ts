// ─────────────────────────────────────────────────────────────────────────────
// Yepper Adsense API Client
// ─────────────────────────────────────────────────────────────────────────────
// Converted from clientZip/src/utils/api.js (React / axios) to
// Next.js TypeScript (fetch-based) to match the yepper-creators style.
//
// MIGRATION NOTES (original was axios + Bearer token from localStorage):
//   • Swapped axios → native fetch (matches rest of yepper-creators)
//   • Token is read from localStorage for now — same auth strategy as
//     the original React app. Once auth is merged, update to cookie-based.
//   • All API namespaces are preserved 1-to-1 so page files can be ported
//     with minimal changes (just swap the import path).
//   • Added ADSENSE_BASE_URL so it can be configured independently of the
//     creators backend.
// ─────────────────────────────────────────────────────────────────────────────

export const ADSENSE_BASE_URL =
  process.env.NEXT_PUBLIC_ADSENSE_API_URL ?? 'http://localhost:5000';

// ── Generic request helper ─────────────────────────────────────────────────

async function adsenseRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T }> {
  // When running in the browser prefer the same-origin Next proxy so the
  // httpOnly `yepper_session` cookie can be used by the server to authenticate
  // requests. Server-side code can call the backend directly.
  const url = typeof window !== 'undefined' ? `/api/proxy${path}` : `${ADSENSE_BASE_URL}${path}`;

  // Token header is optional — client will usually hit the proxy which uses
  // httpOnly cookies. Keep the legacy token read for pages that still rely on
  // a readable cookie/localStorage value.
  const token = typeof window !== 'undefined'
    ? (document.cookie.match(/(?:^|;\s*)yepper_token=([^;]+)/)?.[1] ?? localStorage.getItem('token'))
    : null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type to JSON if not multipart (form-data sets it own boundary)
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (res.status === 401) {
      // [YEPPER-MERGE AUTH] No localStorage to clear. The session cookie will
      // be invalidated by the server or expire naturally. The ProtectedRoute
      // component handles 401 responses by redirecting to /login.
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error((json as { message?: string }).message ?? res.statusText);
      (err as Error & { response: unknown }).response = json;
      throw err;
    }

    return { data: json as T };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Convenience shorthands matching the original axios api object
const adsenseHttp = {
  get:    <T>(path: string)                        => adsenseRequest<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown, opts?: RequestInit) =>
    adsenseRequest<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...opts,
    }),
  patch:  <T>(path: string, body?: unknown)        =>
    adsenseRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown)        =>
    adsenseRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string)                        => adsenseRequest<T>(path, { method: 'DELETE' }),
};

// ═══════════════════════════════════════════════════════════════
// AUTH  (kept here for reference; full auth lives in _lib/api.ts)
// ═══════════════════════════════════════════════════════════════
export const authAPI = {
  register:           (data: unknown) => adsenseHttp.post('/api/auth/register', data),
  registerWaitlist:   (data: unknown) => adsenseHttp.post('/api/auth/register-waitlist', data),
  login:              (data: unknown) => adsenseHttp.post('/api/auth/login', data),
  me:                 ()             => adsenseHttp.get('/api/auth/me'),
  resendVerification: (data: unknown) => adsenseHttp.post('/api/auth/resend-verification', data),
  resendWaitlist:     (data: unknown) => adsenseHttp.post('/api/auth/resend-waitlist-verification', data),
  verifyEmail:        (token: string) => adsenseHttp.get(`/api/auth/verify-email?token=${token}`),
  googleRedirect:     ()             => `/api/auth/google`,
};

// ═══════════════════════════════════════════════════════════════
// PASSWORD
// ═══════════════════════════════════════════════════════════════
export const passwordAPI = {
  forgot:             (data: unknown) => adsenseHttp.post('/api/password/forgot-password', data),
  reset:              (data: unknown) => adsenseHttp.post('/api/password/reset-password', data),
};

// ═══════════════════════════════════════════════════════════════
// WEBSITE  (AdPromoter — publisher side)
// ═══════════════════════════════════════════════════════════════
export const websiteAPI = {
  getAll:               ()                       => adsenseHttp.get('/api/createWebsite'),
  getById:              (id: string)             => adsenseHttp.get(`/api/createWebsite/website/${id}`),
  prepare:              (data: unknown)          => adsenseHttp.post('/api/createWebsite/prepareWebsite', data),
  createWithCategories: (data: unknown)          => adsenseHttp.post('/api/createWebsite/createWebsiteWithCategories', data),
  uploadScreenshot:     (id: string, formData: FormData) =>
    adsenseHttp.post(`/api/createWebsite/upload/${id}`, formData),
  updateName:           (id: string, data: unknown) => adsenseHttp.patch(`/api/createWebsite/${id}/name`, data),
};

// ═══════════════════════════════════════════════════════════════
// AD CATEGORIES  (publisher ad zones)
// ═══════════════════════════════════════════════════════════════
export const categoryAPI = {
  getByWebsite:           (websiteId: string)                 => adsenseHttp.get(`/api/ad-categories/${websiteId}`),
  getByWebsiteAdvertiser: (websiteId: string)                 => adsenseHttp.get(`/api/ad-categories/${websiteId}/advertiser`),
  getById:                (categoryId: string)                => adsenseHttp.get(`/api/ad-categories/categoriees/${categoryId}`),
  getCategoryLanguage:    (categoryId: string)                => adsenseHttp.get(`/api/ad-categories/category/${categoryId}/language`),
  create:                 (data: unknown)                     => adsenseHttp.post('/api/ad-categories', data),
  customize:              (categoryId: string, data: unknown) => adsenseHttp.post(`/api/ad-categories/categoriees/${categoryId}/customization`, data),
  resetUserCount:         (categoryId: string, data: unknown) => adsenseHttp.put(`/api/ad-categories/${categoryId}/reset-user-count`, data),
  updateLanguage:         (categoryId: string, data: unknown) => adsenseHttp.patch(`/api/ad-categories/category/${categoryId}/language`, data),
  delete:                 (categoryId: string)                => adsenseHttp.delete(`/api/ad-categories/${categoryId}`),
  sendInvite:             (categoryId: string, data: unknown)  => adsenseHttp.post(`/api/ad-categories/${categoryId}/send-invite`, data),

  // Wallet
  getWallet:            ()                                 => adsenseHttp.get('/api/ad-categories/wallet'),
  getWalletBalance:     (type: string)                     => adsenseHttp.get(`/api/ad-categories/wallet/${type}/balance`),
  getTransactions:      (type: string, page = 1)           => adsenseHttp.get(`/api/ad-categories/wallet/${type}/transactions?page=${page}&limit=10`),
  requestWithdrawal:    (type: string, data: unknown)      => adsenseHttp.post(`/api/ad-categories/wallet/${type}/withdrawal-request`, data),
  getWithdrawalHistory: (type: string, page = 1)           => adsenseHttp.get(`/api/ad-categories/wallet/${type}/withdrawal-requests?page=${page}&limit=10`),
  cancelWithdrawal:     (requestId: string)                => adsenseHttp.post(`/api/ad-categories/wallet/withdrawal-request/${requestId}/cancel`),

  // Admin
  adminGetWithdrawals:    (params: string) => adsenseHttp.get(`/api/ad-categories/admin/withdrawal-requests?${params}`),
  adminProcessWithdrawal: (id: string, data: unknown) => adsenseHttp.post(`/api/ad-categories/admin/withdrawal-request/${id}/process`, data),

  // Ads management
  getPendingRejections: ()                               => adsenseHttp.get('/api/ad-categories/pending-rejections'),
  getActiveAds:         ()                               => adsenseHttp.get('/api/ad-categories/active-ads'),
  getPendingByUser:     (userId: string)                 => adsenseHttp.get(`/api/ad-categories/pending/${userId}`),
  approveAd:            (adId: string, websiteId: string, categoryId: string) =>
    adsenseHttp.post(`/api/ad-categories/approve/${adId}/website/${websiteId}/${categoryId}`),
  rejectAd:             (adId: string, websiteId: string, categoryId: string) =>
    adsenseHttp.post(`/api/ad-categories/reject/${adId}/website/${websiteId}/${categoryId}`),
};

// ═══════════════════════════════════════════════════════════════
// WEB ADVERTISE  (AdOwner — advertiser side)
// ═══════════════════════════════════════════════════════════════
export const advertiseAPI = {
  create:               (formData: FormData)             => adsenseHttp.post('/api/web-advertise', formData),
  getAdDetails:         (adId: string)                   => adsenseHttp.get(`/api/web-advertise/ad-details/${adId}`),
  getMyAds:             ()                               => adsenseHttp.get('/api/web-advertise/my-ads'),
  getAvailable:         (websiteId: string)              => adsenseHttp.get(`/api/web-advertise/available/${websiteId}`),
  getAvailableAll:      (params: string)                 => adsenseHttp.get(`/api/web-advertise/available?${params}`),
  assign:               (data: unknown)                  => adsenseHttp.post('/api/web-advertise/assign', data),
  selectForWebsite:     (data: unknown)                  => adsenseHttp.post('/api/web-advertise/select-for-website', data),
  addSelections:        (adId: string, data: unknown)    => adsenseHttp.post(`/api/web-advertise/${adId}/add-selections`, data),

  // Payment
  initiatePayment:      (data: unknown) => adsenseHttp.post('/api/web-advertise/payment/initiate', data),
  initiatePaymentModal: (data: unknown) => adsenseHttp.post('/api/web-advertise/initiate-payment', data),
  verifyPayment:        (data: unknown) => adsenseHttp.post('/api/web-advertise/payment/verify', data),
  verifyCallback:       (data: unknown) => adsenseHttp.post('/api/web-advertise/payment/verify-callback', data),
  getWalletBalance:     ()              => adsenseHttp.get('/api/web-advertise/payment/wallet-balance'),
  calculateBreakdown:   (data: unknown) => adsenseHttp.post('/api/web-advertise/payment/calculate-breakdown', data),
  processWallet:        (data: unknown) => adsenseHttp.post('/api/web-advertise/payment/process-wallet', data),
};

// ═══════════════════════════════════════════════════════════════
// BUSINESS CATEGORIES
// ═══════════════════════════════════════════════════════════════
export const businessCategoryAPI = {
  getAll: () => adsenseHttp.get('/api/business-categories/categories'),
};

// ═══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════
export const campaignAPI = {
  general:     (data: unknown) => adsenseHttp.post('/api/campaign-selections', data),
  adult:       (data: unknown) => adsenseHttp.post('/api/adult-campaign', data),
  carOwners:   (data: unknown) => adsenseHttp.post('/api/carOwners-campaign', data),
  countrySide: (data: unknown) => adsenseHttp.post('/api/countrySide-campaign', data),
  parents:     (data: unknown) => adsenseHttp.post('/api/parents-campaign', data),
  transport:   (data: unknown) => adsenseHttp.post('/api/transport-campaign', data),
  youth:       (data: unknown) => adsenseHttp.post('/api/youth-campaign', data),
};

// ═══════════════════════════════════════════════════════════════
// CONVERSATIONS & AI
// ═══════════════════════════════════════════════════════════════
export const conversationAPI = {
  getAll:     ()              => adsenseHttp.get('/api/conversations'),
  getById:    (id: string)    => adsenseHttp.get(`/api/conversations/${id}`),
  create:     (data: unknown) => adsenseHttp.post('/api/conversations', data),
  delete:     (id: string)    => adsenseHttp.delete(`/api/conversations/${id}`),
  aiGenerate: (data: unknown) => adsenseHttp.post('/api/ai/generate', data),
};

// ═══════════════════════════════════════════════════════════════
// HEALTH  (keep-alive / uptime check)
// ═══════════════════════════════════════════════════════════════
export const healthAPI = {
  ping: () => adsenseHttp.get('/health'),
};


// ── Default export (drop-in for old utils/api.js) ──────────────────────────
export default adsenseHttp;
