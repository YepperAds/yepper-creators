# Adsense Route Group

This folder contains the **advertising and monetization** section of Yepper,
merged from `clientZip` (React CRA) into this Next.js project.

## Structure

```
(adsense)/
├── layout.tsx              : Shared layout (no auth wrapper yet)
├── page.tsx                : Hub / landing page
├── ad-owner/pages/         : AdOwner: create & manage ad campaigns
│   ├── ads/                : My campaigns (fully converted)
│   ├── upload-ad/          : New campaign flow
│   ├── ad-details/[adId]/  : Campaign details
│   └── …                   : Other pages (stubs, see TODO below)
├── ad-promoter/pages/      : AdPromoter: publish ads on websites
│   ├── websites/           : My websites
│   ├── website/[websiteId] : Website details
│   └── …                   : Other pages (stubs)
└── admin/pages/            : Admin panel
    ├── dashboard/
    ├── users/
    └── …
```

## Backend

The Adsense section uses `backend-adsense/` (originally `server2`), a separate
Express server running on a different port from the yepper-creators backend.

| Backend         | Port  | Purpose                              |
|-----------------|-------|--------------------------------------|
| `backend/`      | 5000  | Yepper creators (social, auth)       |
| `backend-adsense/` | 5001 | Adsense (ads, payments, websites) |

Run both: `npm run backend:dev` and `npm run backend-adsense:dev`

## Auth: PENDING

Auth is NOT yet merged. The Adsense pages currently read/write a `token` from
`localStorage` (same as the original React app). Once the auth systems are
unified, replace with the cookie-based session approach used in yepper-creators.

## TODO: Full Page Conversions

Pages marked as stubs need their JSX ported. For each stub:
1. Copy the JSX from `clientZip/src/AdOwner/pages/<Name>.js`
2. Replace `react-router-dom` imports with `next/navigation` + `next/link`
3. Replace `useAuth()` with localStorage token reads
4. Replace CRA shared components with Tailwind using design tokens
5. Replace axios `api.*` calls with `advertiseAPI.*` from `_lib/adsense-api.ts`
