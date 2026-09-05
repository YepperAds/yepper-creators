// config/cors.js — shared between server.js (the API) and creators/workerServer.js
// (the ad-video burn-in worker) so both processes enforce the same origin
// allowlist instead of two copies drifting apart.
'use strict';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://yepper-creators-admin.vercel.app',
  'https://yepper-creators-admin.yepper.cc',
  'https://yepper-creators.onrender.com',
  'https://yepper.cc',
  'https://yepper-creators-api.onrender.com',
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

const allowNullOriginPaths = [
  '/api/ads/display',
  '/api/ads/view',
  '/api/ads/click',
  '/api/ads/script',
  '/api/ad-categories/ads/customization',
  '/api/analytics/track',
  '/api/p/',
  '/api/c/',
];

const normalizeOrigin = (origin) => (!origin ? null : origin.endsWith('/') ? origin.slice(0, -1) : origin);
const shouldAllowNull = (path) => allowNullOriginPaths.some((p) => path.startsWith(p));

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (!origin || origin === 'null') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, x-node-key, x-node-ref');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    return next();
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (shouldAllowNull(req.path)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    return next();
  }

  if (allowedOrigins.includes(normalizedOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, x-node-key, x-node-ref');
    res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    return next();
  }

  console.error('✗ Origin rejected:', origin);
  return res.status(403).json({ error: 'CORS Error', message: `CORS policy does not allow access from: ${origin}` });
}

module.exports = corsMiddleware;
