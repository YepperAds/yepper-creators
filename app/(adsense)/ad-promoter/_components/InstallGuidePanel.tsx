'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { X, Copy, Check, BookOpen, Folder, FileCode2, ChevronRight } from 'lucide-react';

// A right-side drawer (not a full page, not a centered popup) so the ad
// space list stays visible right next to it — the owner asked for this
// specifically after the full-page version made them lose that context.
//
// Prose alone ("paste it in app/layout.tsx") was the other thing that didn't
// land — people testing this against a real Next.js project still got lost.
// So each platform also gets a small visual: for real file-based projects
// (Next.js/HTML/React) a mock file tree, editor-sidebar style, with the
// exact file highlighted and numbered to match the step below it; for
// GUI-only platforms (WordPress/Wix/Squarespace) a breadcrumb of the actual
// admin menu path instead, since there's no file tree to show — inventing
// one would be misleading about how those platforms actually work.

type Platform = 'nextjs' | 'html' | 'wordpress' | 'react' | 'nocode';

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'nextjs', label: 'Next.js' },
  { key: 'html', label: 'Plain HTML' },
  { key: 'wordpress', label: 'WordPress' },
  { key: 'react', label: 'React (Vite/CRA)' },
  { key: 'nocode', label: 'Wix / Squarespace' },
];

interface TreeNode {
  name: string;
  kind: 'folder' | 'file';
  step?: 1 | 2;
  note?: string;
  children?: TreeNode[];
}

const STEP_COLOR = {
  1: { bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500' },
  2: { bg: 'bg-blue-500/15', ring: 'ring-blue-500/40', text: 'text-blue-400', badge: 'bg-blue-500' },
} as const;

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const c = node.step ? STEP_COLOR[node.step] : null;
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 rounded ${c ? `${c.bg} ring-1 ${c.ring}` : ''}`}
        style={{ paddingLeft: `${depth * 14 + 6}px`, paddingRight: 6 }}
      >
        {node.kind === 'folder'
          ? <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          : <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${c ? c.text : 'text-zinc-500'}`} />}
        <span className={`text-xs font-mono truncate ${c ? 'text-white font-semibold' : 'text-zinc-400'}`}>{node.name}</span>
        {node.note && <span className="text-[10px] text-zinc-500 truncate">— {node.note}</span>}
        {node.step && (
          <span className={`ml-auto text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-black ${c!.badge}`}>
            {node.step}
          </span>
        )}
      </div>
      {node.children?.map((child, i) => <TreeRow key={i} node={child} depth={depth + 1} />)}
    </div>
  );
}

function FileTree({ root }: { root: TreeNode }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 mb-4">
      <TreeRow node={root} depth={0} />
    </div>
  );
}

function AdminPath({ steps }: { steps: { step: 1 | 2; crumbs: string[] }[] }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2 mb-4">
      {steps.map((s) => {
        const c = STEP_COLOR[s.step];
        return (
          <div key={s.step} className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-black ${c.badge}`}>
              {s.step}
            </span>
            {s.crumbs.map((crumb, j) => (
              <React.Fragment key={j}>
                {j > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                <span className="text-[11px] font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Step({ n, title, body, code }: { n: 1 | 2; title: string; body: React.ReactNode; code: string }) {
  const c = STEP_COLOR[n];
  return (
    <div className="border border-zinc-800 rounded-xl p-3 mb-3">
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-5 h-5 rounded-full text-black flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${c.badge}`}>
          {n}
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{title}</p>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
      <CodeBlock code={code} />
    </div>
  );
}

const VISUALS: Record<
  Platform,
  { kind: 'tree'; root: TreeNode } | { kind: 'path'; steps: { step: 1 | 2; crumbs: string[] }[] }
> = {
  nextjs: {
    kind: 'tree',
    root: {
      name: 'app/', kind: 'folder', children: [
        { name: 'layout.tsx', kind: 'file', step: 1 },
        { name: 'page.tsx', kind: 'file', step: 2, note: 'or wherever this ad belongs' },
        { name: 'blog/', kind: 'folder', children: [{ name: '[slug]/', kind: 'folder', children: [{ name: 'page.tsx', kind: 'file' }] }] },
      ],
    },
  },
  html: {
    kind: 'tree',
    root: {
      name: 'your-site/', kind: 'folder', children: [
        { name: 'header-include.html', kind: 'file', step: 1, note: 'or every page’s <head>' },
        { name: 'contact.html', kind: 'file', step: 2, note: 'the one page this ad is for' },
        { name: 'about.html', kind: 'file' },
      ],
    },
  },
  react: {
    kind: 'tree',
    root: {
      name: 'my-app/', kind: 'folder', children: [
        { name: 'public/', kind: 'folder', children: [{ name: 'index.html', kind: 'file', step: 1 }] },
        { name: 'src/', kind: 'folder', children: [{ name: 'App.tsx', kind: 'file', step: 2, note: 'or whichever page component' }] },
      ],
    },
  },
  wordpress: {
    kind: 'path',
    steps: [
      { step: 1, crumbs: ['Plugins', 'Insert Headers and Footers', 'Header'] },
      { step: 2, crumbs: ['Pages', 'Edit', 'Custom HTML block'] },
    ],
  },
  nocode: {
    kind: 'path',
    steps: [
      { step: 1, crumbs: ['Settings', 'Advanced', 'Custom Code (Header)'] },
      { step: 2, crumbs: ['Page', 'Add Section', 'Embed HTML'] },
    ],
  },
};

const CONTENT: Record<Platform, { scriptWhere: React.ReactNode; divWhere: React.ReactNode }> = {
  nextjs: {
    scriptWhere: <>Paste it once in <code className="text-emerald-400">app/layout.tsx</code>, inside <code className="text-emerald-400">&lt;body&gt;</code> (App Router) — or in <code className="text-emerald-400">pages/_app.tsx</code> on the older Pages Router. It's just a <code className="text-emerald-400">&lt;script src&gt;</code> with no inline logic, so it renders fine from a Server Component — no <code className="text-emerald-400">'use client'</code>, no <code className="text-emerald-400">next/script</code> needed.</>,
    divWhere: <>Paste it directly in the JSX of whichever page this ad belongs on. Same reasoning: plain markup, works from a Server Component with no extra directives.</>,
  },
  html: {
    scriptWhere: <>Paste it in your shared header include (or every page's <code className="text-emerald-400">&lt;head&gt;</code> if you don't have one) — it only needs to go in once per page, but every page needs it.</>,
    divWhere: <>Paste it directly in the HTML body of the one page you want this ad on, right where the box should sit.</>,
  },
  wordpress: {
    scriptWhere: <>Install a small plugin like "Insert Headers and Footers" and paste it into the Header slot — it survives theme updates, no PHP editing needed.</>,
    divWhere: <>In the page/post editor, add a "Custom HTML" block wherever you want the ad, and paste it there.</>,
  },
  react: {
    scriptWhere: <>Paste it in <code className="text-emerald-400">public/index.html</code>'s <code className="text-emerald-400">&lt;head&gt;</code> — unlike Next.js, a Vite/CRA app has one real static HTML file every page loads from.</>,
    divWhere: <>Paste it directly in the JSX <code className="text-emerald-400">return</code> of the component that renders this page. React passes <code className="text-emerald-400">data-*</code> attributes through natively.</>,
  },
  nocode: {
    scriptWhere: <>Find your site's "Custom Code" settings (usually Settings → Advanced → Header Code) and paste it there so it loads on every page.</>,
    divWhere: <>Add an "Embed HTML" / "Code" block on the specific page or section where you want the ad.</>,
  },
};

interface InstallGuidePanelProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  scriptSrc: string;
  label: string;
}

export default function InstallGuidePanel({ open, onClose, categoryId, scriptSrc, label }: InstallGuidePanelProps) {
  const [platform, setPlatform] = useState<Platform>('nextjs');
  if (!open) return null;

  const scriptTag = `<script src="${scriptSrc}" async></script>`;
  const divTag = `<div data-yepper-space="${categoryId}"></div>`;
  const visual = VISUALS[platform];
  const text = CONTENT[platform];

  return (
    <>
      <div className="fixed inset-0 z-[998] bg-black/60" onClick={onClose} />
      <div className="fixed top-0 right-0 z-[999] h-full w-full max-w-md bg-zinc-900 border-l border-zinc-700 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 truncate">
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" /> Installation guide — {label}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 pt-3 shrink-0">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                platform === p.key
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-[11px] text-zinc-500 mb-2">
            {visual.kind === 'tree' ? 'Where these go in your project:' : 'Where these go in your site’s admin panel:'}
          </p>
          {visual.kind === 'tree'
            ? <FileTree root={visual.root} />
            : <AdminPath steps={visual.steps} />}

          <Step n={1} title="Paste the site-wide script (once)" body={text.scriptWhere} code={scriptTag} />
          <Step n={2} title="Paste this ad space's placeholder div" body={text.divWhere} code={divTag} />

          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            After both are live, use "Check live placement" to confirm this ad space is actually showing up where you put it.
          </p>
        </div>
      </div>
    </>
  );
}
