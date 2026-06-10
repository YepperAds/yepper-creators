# TypeScript Error Fix Guide — `(adsense)` module
**1,722 errors across 59 files** — but they collapse into 7 root-cause categories. Fix the categories below in order and most errors disappear automatically.

---

## Summary by error code

| Code | Count | Description |
|---|---|---|
| TS2339 | 556 | Property does not exist on type |
| TS7006 | 306 | Parameter implicitly has `any` type |
| TS18046 | 184 | Value is of type `unknown` |
| TS2345 | 129 | Argument not assignable to parameter type |
| TS2741 | 76 | Required prop missing from JSX element |
| TS7031 | 70 | Binding element implicitly has `any` type |
| TS2322 | 49 | Type not assignable |
| TS7053 | 41 | Element implicitly has `any` index type |
| TS2307 | 12 | Cannot find module |
| others | 299 | Various (mostly cascade from above) |

---

## Category 1 — Wrong router: `react-router-dom` in a Next.js app
**~80 errors** — files using `<Link to="...">`, `useNavigate`, `navigate({state: ...})`

### Files affected
- `components/AdsCard.tsx`, `components/Navbar.tsx`, `components/ProtectedRoute.tsx`, `components/WebsiteCard.tsx`
- Multiple pages using `navigate({ state: ... })` (TS2353 errors)
- `ads/page.tsx` using `<Link to="...">` (TS2322 — prop `to` doesn't exist)

### Root cause
This is a Next.js 13+ `app/` directory project. `react-router-dom` is not installed/typed and its APIs don't exist here.

### Fix
**Remove all `react-router-dom` imports.** Replace with Next.js equivalents:

```tsx
// ❌ Before (react-router-dom)
import { Link, useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/some-path', { state: { adId: '123' } });
<Link to="/some-path">Click</Link>

// ✅ After (Next.js)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/some-path');   // no built-in state; use query params or zustand/context instead
<Link href="/some-path">Click</Link>
```

For passing state between pages, replace `navigate({ state })` with:
- URL query params: `router.push('/path?adId=123')`
- A lightweight global store (zustand) or React context
- `sessionStorage` for one-shot hand-offs

Also replace `<Link to="...">` → `<Link href="...">` everywhere.

---

## Category 2 — `useState<null>` used as a string/error state
**~130 errors (TS2345)** — the pattern `setError("some message")` where state is typed `null`

### Root cause
State was declared as `useState(null)` (TypeScript infers `null`), then string messages are assigned to it.

### Fix
Add a proper type annotation wherever state holds strings:

```tsx
// ❌ Before
const [error, setError] = useState(null);
// later: setError("Business name is required")  ← TS2345

// ✅ After
const [error, setError] = useState<string | null>(null);

// Same pattern applies to any state holding objects:
const [adData, setAdData] = useState<AdData | null>(null);
const [file, setFile] = useState<File | Blob | null>(null);
```

This one fix pattern clears most of the TS2345 errors.

---

## Category 3 — `response.data` and `error` typed as `unknown` (axios)
**~184 errors (TS18046)**

### Root cause
Axios's TypeScript types default response data to `unknown` in strict mode. Code accesses `.data.someField` without narrowing.

### Fix — Option A (quick): cast with type assertion
```tsx
// ❌ Before
const { data } = await api.get('/endpoint');
console.log(data.userId);  // TS18046

// ✅ After
const { data } = await api.get<{ userId: string }>('/endpoint');
console.log(data.userId);  // ✓
```

### Fix — Option B (proper): define response interfaces
Create a `types/api.ts` file:
```tsx
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface AdData {
  _id: string;
  businessName: string;
  businessLink: string;
  businessLocation: string;
  adDescription: string;
  businessCategory: string;
  imageUrl?: string;
  type?: string;
  url?: string;
  // ...etc
}

export interface WebsiteData {
  _id: string;
  websiteName: string;
  websiteLink: string;
  imageUrl?: string;
  categories?: CategoryData[];
  businessCategories?: string[];
  websiteSelections?: any[];
}
```

Then type your axios calls:
```tsx
const { data } = await api.get<ApiResponse<AdData>>('/api/ads/...');
```

### Fix — Option C (minimal): cast error in catch blocks
```tsx
// ❌
catch (error) { setError(error.message) }  // TS18046

// ✅
catch (error) {
  const err = error as Error;
  setError(err.message ?? 'An error occurred');
}
```

---

## Category 4 — Missing `icon` prop on `<Button>` component
**~76 errors (TS2741)**

### Root cause
`components/components.tsx`'s `Button` component has `icon` as a **required** prop (no default). Every call site that omits it gets TS2741.

### Fix
Make `icon` optional in `components/components.tsx`:
```tsx
// ❌ Before (in components.tsx)
export const Button = ({ children, icon, ... }) => { ... }
// icon has no default value → required

// ✅ After
export const Button = ({
  children,
  icon = null,    // ← give it a default
  iconPosition = 'right',
  ...
}) => { ... }
```

This single change clears ~76 errors across all call sites.

---

## Category 5 — Untyped props in local components (`button.tsx`, `card.tsx`, `alert.tsx`)
**~70 errors (TS7031)** — in `ad-promoter/_components/`

### Root cause
Local component files (`button.tsx`, `card.tsx`, `alert.tsx`) have untyped destructured props: `({ className, variant, size })` with no type annotation, so TypeScript can't infer the prop shape.

### Fix
Add prop interfaces:
```tsx
// ❌ Before (ad-promoter/_components/button.tsx)
const Button = ({ className, variant, size, children, ...props }) => { ... }

// ✅ After
interface ButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}
const Button = ({ className, variant = 'primary', size = 'md', children, ...props }: ButtonProps) => { ... }
```

Apply the same pattern to `card.tsx` and `alert.tsx`.

Also fix `helperText` being required in your `Input`-like component — add `helperText?: string` or give it a default.

---

## Category 6 — Data typed as `never` (empty array / wrong state init)
**~200+ errors (TS2339 on `never`)** — accessing `.websiteName`, `.categories`, `.businessCategories`, etc on `never`

### Root cause
State initialised as an empty array `useState([])` is inferred as `never[]`. Any `.map()` over it gives `never` typed items, so accessing any property on them fails.

### Fix
Always type your array state:
```tsx
// ❌ Before
const [websites, setWebsites] = useState([]);
websites.map(w => w.websiteName)  // TS2339: websiteName doesn't exist on never

// ✅ After
interface Website {
  _id: string;
  websiteName: string;
  websiteLink: string;
  imageUrl?: string;
  categories?: Category[];
  businessCategories?: string[];
}
const [websites, setWebsites] = useState<Website[]>([]);
websites.map(w => w.websiteName)  // ✓
```

The most-needed interfaces based on error patterns:
- `Website` (70 errors for `_id`, `websiteName`, `websiteLink`, `categories`)
- `Ad` / `AdData` (`businessName`, `adDescription`, `imageUrl`, `type`, `url`, `click`)
- `Category` (`categoryName`, `description`, `price`, `tier`)
- `WalletData` (`amount`, `totalEarned`, `byDay`, `paymentAmount`)

---

## Category 7 — Wrong import paths / missing modules (TS2307)
**12 errors** — mostly inside `ad-promoter/pages/` importing from wrong relative paths

### Missing imports
| Import in file | Correct path |
|---|---|
| `'../components/PricingTiers'` | `'../../_components/PricingTiers'` |
| `'../components/CategoryInfoModal'` | `'../../_components/CategoryInfoModal'` |
| `'../components/codeDisplay'` | `'../../_components/codeDisplay'` |
| `'../components/DeleteCategoryModal'` | `'../../_components/DeleteCategoryModal'` |
| `'../components/AdCustomizationModal'` | `'../../_components/AdCustomizationModal'` |
| `'../components/TrafficGrantBanner'` | `'../../_components/TrafficGrantBanner'` |
| `'../../components/Navbar'` | Check actual path from `ad-reports/page.tsx` |
| `'./addNewCategory'` | File doesn't exist — needs to be created or import removed |

---

## Category 8 — Misc targeted fixes

### `FlutterwaveCheckout` not on `window` (TS2339)
```tsx
// ❌
window.FlutterwaveCheckout({ ... })

// ✅
declare global {
  interface Window { FlutterwaveCheckout: (config: FlutterwaveConfig) => void; }
}
```

### `signup` not in `AuthContextType` (TS2339)
`AuthContext.tsx` only exposes `login` and `logout`. Either add `signup` to the context or call `authAPI.register()` directly.

### `timeout` not in `RequestInit` (TS2353)
`fetch()` doesn't support a `timeout` option natively. Use `AbortController` instead:
```tsx
const controller = new AbortController();
const id = setTimeout(() => controller.abort(), 10000);
const response = await fetch(url, { signal: controller.signal });
clearTimeout(id);
```

### `event.target.result` on `EventTarget` (TS18047 / TS2339)
```tsx
// ❌
reader.onload = (event) => { setPreview(event.target.result) }

// ✅
reader.onload = (event) => {
  const result = (event.target as FileReader).result;
  setPreview(result as string);
}
```

---

## Recommended fix order

1. **Install/remove `react-router-dom`** — switch all imports to `next/link` and `next/navigation` (clears TS2307 + all the `to`/`state` errors)
2. **Add prop interfaces to local components** (`Button` icon default, `button.tsx`, `card.tsx`) — clears ~150 errors
3. **Type all `useState([])` and `useState(null)` calls** — create shared `types/` file — clears ~400 errors
4. **Type axios responses** — clears ~184 TS18046 errors
5. **Fix import paths** in `ad-promoter/pages/`
6. **Add `window.FlutterwaveCheckout` declaration**
7. **Fix remaining one-off issues** (`signup`, `timeout`, `FileReader`, etc.)

---

## Biggest files to prioritise

| File | Errors | Main issues |
|---|---|---|
| `ad-promoter/pages/website/[websiteId]/page.tsx` | 212 | All 7 categories |
| `ad-owner/pages/direct-ad/page.tsx` | 97 | State types, unknown data, routing |
| `ad-owner/pages/select-categories/page.tsx` | 81 | `never[]` state, implicit `any` |
| `ad-owner/pages/select-categories-for-ad/page.tsx` | 81 | Same |
| `components/MarketingAssistant.tsx` | 74 | `never[]`, implicit `any` |
| `utils/api.tsx` | 69 | Untyped function parameters |
| `ad-promoter/pages/create-categories/[websiteId]/page.tsx` | 64 | Wrong imports + state types |