'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, BookOpen } from 'lucide-react';

// Where the two integration snippets — the site-wide <script>, and this
// space's own placeholder <div> — actually go differs enough by platform
// that a single generic "paste this somewhere" instruction was the main
// thing tripping people up (Next.js especially: whether a plain <script>
// tag needs 'use client' or next/script inside the app router). It doesn't
// — a <script src> with no inline logic is just markup, same as an <img>,
// so it renders fine straight out of a Server Component. Each platform
// below states exactly where, in its own terms, instead of leaving that
// translation up to the reader.
type Platform = 'nextjs' | 'html' | 'wordpress' | 'react' | 'nocode';

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'nextjs', label: 'Next.js' },
  { key: 'html', label: 'Plain HTML' },
  { key: 'wordpress', label: 'WordPress' },
  { key: 'react', label: 'React (Vite/CRA)' },
  { key: 'nocode', label: 'Wix / Squarespace' },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Step({ n, title, body, code }: { n: number; title: string; body: React.ReactNode; code: string }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
          {n}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
      <CodeBlock code={code} />
    </div>
  );
}

export default function InstallGuidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryId = params?.categoryId as string;
  const scriptSrc = searchParams.get('scriptSrc') || '';
  const label = searchParams.get('label') || 'Ad space';

  const [platform, setPlatform] = useState<Platform>('nextjs');

  const scriptTag = `<script src="${scriptSrc}" async></script>`;
  const divTag = `<div data-yepper-space="${categoryId}"></div>`;

  const content: Record<Platform, { scriptWhere: React.ReactNode; divWhere: React.ReactNode }> = {
    nextjs: {
      scriptWhere: <>Paste it once in <code className="text-emerald-400">app/layout.tsx</code>, inside <code className="text-emerald-400">&lt;body&gt;</code> (App Router) — or in <code className="text-emerald-400">pages/_app.tsx</code> / <code className="text-emerald-400">pages/_document.tsx</code> if you're on the older Pages Router. It's just a <code className="text-emerald-400">&lt;script src&gt;</code> with no inline logic, so it renders fine straight from a Server Component — no <code className="text-emerald-400">'use client'</code> and no <code className="text-emerald-400">next/script</code> needed.</>,
      divWhere: <>Paste it directly in the JSX of whichever page this ad belongs on — e.g. <code className="text-emerald-400">app/page.tsx</code> or <code className="text-emerald-400">app/blog/[slug]/page.tsx</code>. Same reasoning: it's plain markup, works from a Server Component with no extra directives.</>,
    },
    html: {
      scriptWhere: <>Paste it in your shared <code className="text-emerald-400">&lt;head&gt;</code> (or just before <code className="text-emerald-400">&lt;/body&gt;</code>) — whatever header/footer include is shared across every page on your site, so it only needs to go in once.</>,
      divWhere: <>Paste it directly in the HTML body of the one page where you want this ad to appear, exactly where you want the box to sit.</>,
    },
    wordpress: {
      scriptWhere: <>Easiest: install a small plugin like "Insert Headers and Footers" and paste it into the header slot — it survives theme updates. Editing directly: Appearance → Theme File Editor → <code className="text-emerald-400">header.php</code>, just before <code className="text-emerald-400">&lt;/head&gt;</code>.</>,
      divWhere: <>In the page/post editor, add a "Custom HTML" block wherever you want the ad to sit, and paste it in there.</>,
    },
    react: {
      scriptWhere: <>Paste it in <code className="text-emerald-400">public/index.html</code>'s <code className="text-emerald-400">&lt;head&gt;</code> — unlike Next.js, a plain Vite/CRA app has one real static HTML file that every page loads from.</>,
      divWhere: <>Paste it directly in the JSX <code className="text-emerald-400">return</code> of whichever component renders the page this ad belongs on. React passes through <code className="text-emerald-400">data-*</code> attributes natively, no extra work needed.</>,
    },
    nocode: {
      scriptWhere: <>Find your site's "Custom Code" / "Embed" settings — usually Settings → Advanced → Header Code — and paste it there so it loads on every page.</>,
      divWhere: <>Add an "Embed HTML" / "Code" block on the specific page or section where you want the ad, and paste it in there.</>,
    },
  };

  const current = content[platform];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-sm font-semibold truncate flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" /> Installation guide — {label}
          </h1>
          <span className="w-16 shrink-0" />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                platform === p.key
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Step n={1} title="Paste the site-wide script (once)" body={current.scriptWhere} code={scriptTag} />
          <Step n={2} title="Paste this ad space's placeholder div" body={current.divWhere} code={divTag} />
        </div>

        <p className="text-xs text-zinc-500 mt-6 leading-relaxed">
          After both are live, use "Check live placement" back on the dashboard to confirm this ad space is actually
          showing up where you put it.
        </p>
      </div>
    </div>
  );
}
