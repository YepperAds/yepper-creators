// @ts-nocheck
import axios from 'axios';

export const BASE_URL =
  process.env.NEXT_PUBLIC_ADSENSE_API_URL ?? 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Read the JWT from the yepper_token cookie (set at login, readable by JS).
// Falls back to localStorage for backward compat during transition.
function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)yepper_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return localStorage.getItem('token'); // legacy fallback
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Cookie is cleared server-side on logout; nothing to do here client-side
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  register:           (data: unknown) => api.post('/api/auth/register', data),
  registerWaitlist:   (data: unknown) => api.post('/api/auth/register-waitlist', data),
  login:              (data: unknown) => api.post('/api/auth/login', data),
  me:                 ()              => api.get('/api/auth/me'),
  resendVerification: (data: unknown) => api.post('/api/auth/resend-verification', data),
  resendWaitlist:     (data: unknown) => api.post('/api/auth/resend-waitlist-verification', data),
  verifyEmail:        (token: string) => api.get(`/api/auth/verify-email?token=${token}`),
  googleRedirect:     ()              => `/api/auth/google`,
};

export const passwordAPI = {
  forgot: (data: unknown) => api.post('/api/password/forgot-password', data),
  reset:  (data: unknown) => api.post('/api/password/reset-password', data),
};

export const websiteAPI = {
  getAll:               ()                        => api.get('/api/createWebsite'),
  getById:              (id: string)              => api.get(`/api/createWebsite/website/${id}`),
  prepare:              (data: unknown)           => api.post('/api/createWebsite/prepareWebsite', data),
  createWithCategories: (data: unknown)           => api.post('/api/createWebsite/createWebsiteWithCategories', data),
  uploadScreenshot:     (id: string, formData: FormData) => api.post(`/api/createWebsite/upload/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateName: (id: string, data: unknown) => api.patch(`/api/createWebsite/${id}/name`, data),
};

export const categoryAPI = {
  getByWebsite:           (websiteId: string)                                    => api.get(`/api/ad-categories/${websiteId}`),
  getByWebsiteAdvertiser: (websiteId: string)                                    => api.get(`/api/ad-categories/${websiteId}/advertiser`),
  getById:                (categoryId: string)                                   => api.get(`/api/ad-categories/categoriees/${categoryId}`),
  getCategoryLanguage:    (categoryId: string)                                   => api.get(`/api/ad-categories/category/${categoryId}/language`),
  create:                 (data: unknown)                                        => api.post('/api/ad-categories', data),
  customize:              (categoryId: string, data: unknown)                    => api.post(`/api/ad-categories/categoriees/${categoryId}/customization`, data),
  resetUserCount:         (categoryId: string, data: unknown)                    => api.put(`/api/ad-categories/${categoryId}/reset-user-count`, data),
  updateLanguage:         (categoryId: string, data: unknown)                    => api.patch(`/api/ad-categories/category/${categoryId}/language`, data),
  delete:                 (categoryId: string)                                   => api.delete(`/api/ad-categories/${categoryId}`),
  getWallet:              ()                                                     => api.get('/api/ad-categories/wallet'),
  getWalletBalance:       (type: string)                                         => api.get(`/api/ad-categories/wallet/${type}/balance`),
  getTransactions:        (type: string, page = 1)                               => api.get(`/api/ad-categories/wallet/${type}/transactions?page=${page}&limit=10`),
  requestWithdrawal:      (type: string, data: unknown)                          => api.post(`/api/ad-categories/wallet/${type}/withdrawal-request`, data),
  getWithdrawalHistory:   (type: string, page = 1)                               => api.get(`/api/ad-categories/wallet/${type}/withdrawal-requests?page=${page}&limit=10`),
  cancelWithdrawal:       (requestId: string)                                    => api.post(`/api/ad-categories/wallet/withdrawal-request/${requestId}/cancel`),
  adminGetWithdrawals:    (params: string)                                       => api.get(`/api/ad-categories/admin/withdrawal-requests?${params}`),
  adminProcessWithdrawal: (id: string, data: unknown)                            => api.post(`/api/ad-categories/admin/withdrawal-request/${id}/process`, data),
  getPendingRejections:   ()                                                     => api.get('/api/ad-categories/pending-rejections'),
  getActiveAds:           ()                                                     => api.get('/api/ad-categories/active-ads'),
  getPendingByUser:       (userId: string)                                       => api.get(`/api/ad-categories/pending/${userId}`),
  approveAd:              (adId: string, websiteId: string, categoryId: string)  => api.post(`/api/ad-categories/approve/${adId}/website/${websiteId}/${categoryId}`),
  rejectAd:               (adId: string, websiteId: string, categoryId: string)  => api.post(`/api/ad-categories/reject/${adId}/website/${websiteId}/${categoryId}`),
};

export const advertiseAPI = {
  create:               (formData: FormData)        => api.post('/api/web-advertise', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAdDetails:         (adId: string)              => api.get(`/api/web-advertise/ad-details/${adId}`),
  getAvailable:         (websiteId: string)         => api.get(`/api/web-advertise/available/${websiteId}`),
  getAvailableAll:      (params: string)            => api.get(`/api/web-advertise/available?${params}`),
  assign:               (data: unknown)             => api.post('/api/web-advertise/assign', data),
  selectForWebsite:     (data: unknown)             => api.post('/api/web-advertise/select-for-website', data),
  addSelections:        (adId: string, data: unknown) => api.post(`/api/web-advertise/${adId}/add-selections`, data),
  initiatePayment:      (data: unknown)             => api.post('/api/web-advertise/payment/initiate', data),
  initiatePaymentModal: (data: unknown)             => api.post('/api/web-advertise/initiate-payment', data),
  verifyPayment:        (data: unknown)             => api.post('/api/web-advertise/payment/verify', data),
  verifyCallback:       (data: unknown)             => api.post('/api/web-advertise/payment/verify-callback', data),
  getWalletBalance:     ()                          => api.get('/api/web-advertise/payment/wallet-balance'),
  calculateBreakdown:   (data: unknown)             => api.post('/api/web-advertise/payment/calculate-breakdown', data),
  processWallet:        (data: unknown)             => api.post('/api/web-advertise/payment/process-wallet', data),
};

export const businessCategoryAPI = {
  getAll: () => api.get('/api/business-categories/categories'),
};

export const campaignAPI = {
  general:     (data: unknown) => api.post('/api/campaign-selections', data),
  adult:       (data: unknown) => api.post('/api/adult-campaign', data),
  carOwners:   (data: unknown) => api.post('/api/carOwners-campaign', data),
  countrySide: (data: unknown) => api.post('/api/countrySide-campaign', data),
  parents:     (data: unknown) => api.post('/api/parents-campaign', data),
  transport:   (data: unknown) => api.post('/api/transport-campaign', data),
  youth:       (data: unknown) => api.post('/api/youth-campaign', data),
};

export const conversationAPI = {
  getAll:     ()              => api.get('/api/conversations'),
  getById:    (id: string)    => api.get(`/api/conversations/${id}`),
  create:     (data: unknown) => api.post('/api/conversations', data),
  delete:     (id: string)    => api.delete(`/api/conversations/${id}`),
  aiGenerate: (data: unknown) => api.post('/api/ai/generate', data),
};

export const brandAPI = {
  auth:      (data: unknown) => api.post('/api/brandAuth', data),
  analytics: ()              => api.get('/api/brandAnalytics'),
};

export const healthAPI = {
  ping: () => api.get('/health'),
};
