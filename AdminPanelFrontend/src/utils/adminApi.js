// admin/utils/adminApi.js
const BASE = process.env.REACT_APP_API_URL || 'https://yepper-creators-api.onrender.com';
export { BASE };

export const adminFetch = async (path, options = {}, adminHeaders = {}) => {
  const res = await fetch(`${BASE}/api/admin${path}`, {
    ...options,
    headers: { ...adminHeaders, ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// For endpoints that aren't under /api/admin (e.g. the already-public
// website/category browse endpoints reused by the Hot Deals builder).
export const publicFetch = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};
