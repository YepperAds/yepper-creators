'use client';
// @ts-nocheck

import React, { useState } from 'react';
import {
  Copy, Check, Plus, Code, Info, Zap, MousePointer, Globe,
  Trash2, X, ChevronDown, ChevronRight, BookOpen, Mail,
  Code2, Braces, Server, Terminal, Layers, Puzzle, BookMarked, Atom,
} from 'lucide-react';

const AUTO_RELIABLE = [
  'header','floating','overlay','modalpic',
  'mobile interstitial','bottom','profooter'
];

// ── Supported frameworks (icons only — no emojis) ─────────────────────────────
// "Vanilla JS" (not "JavaScript") is deliberate — a React site IS technically
// JavaScript, and that label alone was getting picked by React/Next.js owners
// over the dedicated React/Next.js tabs, who then pasted a raw `style="..."`
// string into JSX and broke their build (react/style-prop-object). Putting
// React and Next.js right next to it keeps the framework-specific tabs from
// being missed.
const FRAMEWORKS = [
  { id: 'html',       label: 'HTML',        Icon: Code2 },
  { id: 'javascript', label: 'Vanilla JS',  Icon: Braces },
  { id: 'react',      label: 'React',       Icon: Atom },
  { id: 'nextjs',     label: 'Next.js',     Icon: Layers },
  { id: 'vue',        label: 'Vue.js',      Icon: Puzzle },
  { id: 'php',        label: 'PHP',         Icon: Server },
  { id: 'python',     label: 'Python',      Icon: Terminal },
  { id: 'wordpress',  label: 'WordPress',   Icon: BookMarked },
];

const HUMAN_LANGUAGES = [
  { value: 'english',     label: 'English' },
  { value: 'french',      label: 'French (Français)' },
  { value: 'kinyarwanda', label: 'Kinyarwanda' },
  { value: 'kiswahili',   label: 'Swahili' },
  { value: 'chinese',     label: 'Chinese (中文)' },
  { value: 'spanish',     label: 'Spanish (Español)' },
];

// ── Main site script per framework ────────────────────────────────────────────
function buildSiteScript(src, framework) {
  switch (framework) {
    case 'javascript':
      return `// Add to any existing JS file, or inline in a <script> tag
document.addEventListener('DOMContentLoaded', function () {
  var s = document.createElement('script');
  s.src = '${src}';
  s.async = true;
  document.head.appendChild(s);
});`;

    case 'nextjs':
      return `// app/layout.js — App Router (Next.js 13+)
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script src="${src}" strategy="afterInteractive" />
      </body>
    </html>
  );
}

// pages/_document.js — Pages Router
// import { Html, Head, Main, NextScript } from 'next/document';
// export default function Document() {
//   return (
//     <Html>
//       <Head>
//         <script src="${src}" async />
//       </Head>
//       <body><Main /><NextScript /></body>
//     </Html>
//   );
// }`;

    case 'react':
      return `// src/App.jsx (or your root component) — Create React App, Vite, etc.
import { useEffect } from 'react';

useEffect(() => {
  const script = document.createElement('script');
  script.src = '${src}';
  script.async = true;
  document.head.appendChild(script);
  return () => document.head.removeChild(script);
}, []);

// ─── OR add it directly to public/index.html instead ───────────
// <script src="${src}" async></script>`;

    case 'vue':
      return `// src/main.js — add before app.mount()
const script = document.createElement('script');
script.src = '${src}';
script.async = true;
document.head.appendChild(script);

// ─── OR in App.vue using onMounted ─────────────────────
// <script setup>
// import { onMounted } from 'vue';
// onMounted(() => {
//   const s = document.createElement('script');
//   s.src = '${src}';
//   s.async = true;
//   document.head.appendChild(s);
// });
// </script>`;

    case 'wordpress':
      return `<?php
// Add to your theme's functions.php

function yepper_enqueue_script() {
    wp_enqueue_script(
        'yepper-ads',
        '${src}',
        array(),   // no dependencies
        null,      // no version (auto-updates)
        false      // load in <head>
    );
    add_filter('script_loader_tag', function($tag, $handle) {
        if ($handle === 'yepper-ads') {
            return str_replace('<script', '<script async', $tag);
        }
        return $tag;
    }, 10, 2);
}
add_action('wp_enqueue_scripts', 'yepper_enqueue_script');`;

    case 'php':
      return `<?php
// In your main PHP layout file (header.php, layout.php, etc.)
echo '<script src="${src}" async></script>';
?>

<!-- Or directly in HTML: -->
<script src="${src}" async></script>`;

    case 'python':
      return `{# Django — base.html template #}
{% block head %}
  <script src="${src}" async></script>
{% endblock %}

{# ─── Flask — base.html Jinja2 template ──────────────── #}
{# <script src="${src}" async></script>                    #}

{# FastAPI / other Python frameworks:                      #}
{# Add the script tag to your base HTML template.          #}`;

    default: // html
      return `<script src="${src}" async></script>`;
  }
}

// ── Manual placement div per framework ───────────────────────────────────────
// Standard ad-unit sizes (industry-standard, same ones AdSense/Carbon Ads
// use) keyed by spaceType — picked so the box reads naturally wherever that
// type usually sits (a 728x90 leaderboard for in-feed/above-the-fold, a
// narrow 160x600 skyscraper for rails, etc). Owners can resize the iframe
// attributes freely; this is just a sane default.
function recommendedEmbedSize(spaceType) {
  const sizes = {
    'sidebar':         { w: 300, h: 250 },
    'left rail':       { w: 160, h: 600 },
    'rightrail':       { w: 160, h: 600 },
    'stickysidebar':   { w: 300, h: 250 },
    'inline content':  { w: 300, h: 250 },
    'in feed':         { w: 728, h: 90 },
    'above the fold':  { w: 728, h: 90 },
    'beneath title':   { w: 728, h: 90 },
  };
  return sizes[(spaceType || '').toLowerCase()] || { w: 300, h: 250 };
}

// Iframe embed — for spaceTypes the main site script can't reliably auto-place
// (sidebar, in-feed, inline content, etc). The owner drops this exactly where
// they want the ad. Because it's a separate document, a framework's own
// re-renders (React/Vue/etc. own the <iframe> element itself, never its
// contents) can't wipe it out the way they can a script-injected div, and it
// doesn't depend on the main script finding a data-yepper-space placeholder.
function buildIframeEmbed(framework, src, spaceType) {
  const { w, h } = recommendedEmbedSize(spaceType);
  switch (framework) {
    case 'nextjs':
      return `{/* Place this exactly where you want the ad */}
<iframe
  src="${src}"
  width={${w}}
  height={${h}}
  style={{ border: 0, maxWidth: '100%' }}
  loading="lazy"
  title="Advertisement"
/>`;
    case 'react':
      return `{/* Place this exactly where you want the ad */}
<iframe
  src="${src}"
  width={${w}}
  height={${h}}
  style={{ border: 0, maxWidth: '100%' }}
  loading="lazy"
  title="Advertisement"
/>`;
    case 'vue':
      return `<!-- Place this exactly where you want the ad -->
<iframe
  src="${src}"
  width="${w}"
  height="${h}"
  style="border:0;max-width:100%;"
  loading="lazy"
  title="Advertisement"
></iframe>`;
    case 'wordpress':
    case 'php':
      return `<?php echo '<iframe src="${src}" width="${w}" height="${h}" style="border:0;max-width:100%;" loading="lazy" title="Advertisement"></iframe>'; ?>
<!-- Or directly: -->
<iframe src="${src}" width="${w}" height="${h}" style="border:0;max-width:100%;" loading="lazy" title="Advertisement"></iframe>`;
    case 'python':
      return `{# Django/Flask Jinja2 template #}
<iframe src="${src}" width="${w}" height="${h}" style="border:0;max-width:100%;" loading="lazy" title="Advertisement"></iframe>`;
    case 'javascript':
      return `<!-- Plain HTML/vanilla JS only — building with React or Next.js?
     Use the "React" or "Next.js" tab instead: this style="..." string
     is invalid JSX and will fail a build that lints for it. -->
<iframe src="${src}" width="${w}" height="${h}" style="border:0;max-width:100%;" loading="lazy" title="Advertisement"></iframe>

// Or create it dynamically:
const el = document.createElement('iframe');
el.src = '${src}';
el.width = ${w}; el.height = ${h};
el.style.border = '0'; el.style.maxWidth = '100%';
el.loading = 'lazy';
document.querySelector('#your-container').appendChild(el);`;
    default: // html
      return `<iframe src="${src}" width="${w}" height="${h}" style="border:0;max-width:100%;" loading="lazy" title="Advertisement"></iframe>`;
  }
}

// ── Installation steps per framework ─────────────────────────────────────────
function getInstallSteps(framework, src) {
  const steps = {
    html: [
      'Open your HTML file (e.g. index.html).',
      'Find the <head> section.',
      'Paste the script tag anywhere inside <head> — or just before </body>.',
      'Save and reload your site.',
    ],
    javascript: [
      'Add the DOMContentLoaded snippet to any JS file that runs on every page.',
      'Or paste it as a <script> tag in your HTML.',
      'The listener ensures the Yepper script loads after the page is ready.',
      'For precise-placement spaces, paste the <iframe> tag where you want each ad — no script needed for those.',
    ],
    nextjs: [
      'Use Next.js\'s built-in <Script> component — no install needed.',
      'For App Router: add it to app/layout.js with strategy="afterInteractive".',
      'For Pages Router: add to pages/_document.js inside <Head>.',
      'For precise-placement spaces, drop the <iframe> directly in any JSX — it\'s a normal element, safe from re-renders.',
      'The script auto-loads on every page because it\'s in the root layout.',
    ],
    react: [
      'Add the useEffect snippet to your root component (e.g. App.jsx) — it injects the script once on mount.',
      'Or skip the useEffect and paste the <script> tag straight into public/index.html instead.',
      'For precise-placement spaces, drop the <iframe> directly in any JSX — it\'s a normal element, safe from re-renders.',
      'Note: the iframe\'s style prop is an object ({ border: 0, ... }), not a CSS string — required by JSX.',
    ],
    vue: [
      'Open src/main.js (or main.ts).',
      'Add the script creation code before app.mount().',
      'Or add it inside onMounted() in your root App.vue.',
      'For precise-placement spaces, paste the <iframe> in any .vue template — no script involvement needed.',
    ],
    wordpress: [
      'Go to Appearance → Theme Editor in your WordPress Admin.',
      'Open your active theme\'s functions.php file.',
      'Paste the PHP snippet at the end of functions.php.',
      'Save. The script will load on every page of your site.',
      'For precise-placement spaces, echo the iframe tag in your theme templates.',
    ],
    php: [
      'Open your main PHP layout file (header.php, layout.php, base.php, etc.).',
      'Paste the script echo or raw HTML tag inside <head>.',
      'It will load on every page that includes this layout file.',
      'For precise-placement spaces, echo the iframe tag in any template where you want an ad.',
    ],
    python: [
      'Open your base template (base.html for Django or Flask).',
      'Add the <script> tag inside the head block.',
      'Templates that extend base.html will automatically include the script.',
      'For precise-placement spaces, paste the <iframe> tag in any template — no script needed for those.',
    ],
  };
  return steps[framework] || steps.html;
}

// ── Copy button ───────────────────────────────────────────────────────────────
const CopyBtn = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-[#fff] transition-all border border-zinc-700 shrink-0"
    >
      {copied
        ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></>
        : <><Copy className="w-3 h-3" /><span>Copy</span></>}
    </button>
  );
};

// ── Code block ────────────────────────────────────────────────────────────────
const CodeBlock = ({ code }) => (
  <div className="bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
    <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-red-500 opacity-60" />
        <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-60" />
        <div className="w-2 h-2 rounded-full bg-green-500 opacity-60" />
      </div>
      <CopyBtn text={code} />
    </div>
    <div className="p-3 overflow-x-auto">
      {code.split('\n').map((line: any, i: any) => (
        <div key={i} className="flex min-w-max">
          <span className="text-zinc-700 select-none w-6 text-right pr-2 shrink-0 text-xs font-mono">{i + 1}</span>
          <span className="pl-2 text-xs font-mono whitespace-pre text-zinc-300">{line}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Framework selector ────────────────────────────────────────────────────────
const FrameworkPicker = ({ active, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {FRAMEWORKS.map(({ id, label, Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          active === id
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
        }`}
      >
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </button>
    ))}
  </div>
);

// ── Installation steps accordion ─────────────────────────────────────────────
const InstallSteps = ({ framework, src }) => {
  const [open, setOpen] = useState(false);
  const steps = getInstallSteps(framework, src);
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>Step-by-step installation guide</span>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
      </button>
      {open && (
        <ol className="px-4 py-3 space-y-2 border-t border-zinc-700">
          {steps.map((step: any, i: any) => (
            <li key={i} className="flex gap-2.5 text-xs text-zinc-400">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-900 border border-blue-700 text-blue-300 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
              <span className="leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

// ── Main integration component ────────────────────────────────────────────────
export const MasterIntegration = ({ website, categories = [], onAddSpace, onLanguageChange, onDeleteCategory, onSendInvite, earningsSummary, scriptInstalled = false }) => {
  const [open, setOpen]           = useState(true);
  const [framework, setFramework] = useState('html');
  const [humanLang, setHumanLang] = useState('english');
  const [langSaved, setLangSaved] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const extractSrc = (val) => {
    if (!val) return null;
    const match = val.match(/src=["']([^"']+)['"]/);
    return match ? match[1] : val;
  };
  const rawSrc = extractSrc(website?.site_script) || `${BACKEND}/api/p/site/${website?.id}`;

  const mainCode    = buildSiteScript(rawSrc, framework);
  const currentLabel = HUMAN_LANGUAGES.find(l => l.value === humanLang)?.label || 'English';

  // Spaces the main site script can't reliably auto-place — these get an
  // iframe embed instead of a data-yepper-space div (see buildIframeEmbed).
  const embedCategories = categories.filter(
    (cat: any) => !AUTO_RELIABLE.includes((cat.spaceType || '').toLowerCase())
  );

  const handleSaveLang = () => {
    if (onLanguageChange) onLanguageChange(humanLang);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  };

  return (
    <div className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Code className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-100">Integration Codes</p>
            <p className="text-xs text-zinc-500">
              {categories.length} space{categories.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="border-t border-zinc-700">

          {/* Framework picker */}
          <div className="px-5 py-4 border-b border-zinc-700 bg-zinc-950">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> Choose your framework / technology
            </p>
            <FrameworkPicker active={framework} onChange={setFramework} />
          </div>

          {/* Language selector */}
          <div className="px-5 py-3 border-b border-zinc-700 bg-zinc-950 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-medium text-zinc-300">Ads Language</span>
              <span className="text-zinc-600">— all spaces serve ads in:</span>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <select
                value={humanLang}
                onChange={e => { setHumanLang(e.target.value); setLangSaved(false); }}
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-zinc-500"
              >
                {HUMAN_LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <button
                onClick={handleSaveLang}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                  langSaved
                    ? 'bg-green-900 border-green-700 text-green-300'
                    : 'bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                {langSaved ? <><Check className="w-3 h-3" /> Saved</> : 'Apply to All'}
              </button>
            </div>
          </div>

          {/* Main script */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-100">
                Main Site Script — paste this <strong>once</strong> on every page
              </h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This single script handles <strong className="text-zinc-300">all</strong> your ad spaces automatically.
              You only need one copy across your entire site. Never change it when you add more spaces.
            </p>
            <CodeBlock code={mainCode} />
            <InstallSteps framework={framework} src={rawSrc} />
            <div className="bg-blue-950 border border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-300 flex items-start gap-2">
              <Zap className="w-3 h-3 shrink-0 mt-0.5" />
              <span>Works for all auto-placed spaces: Header, Footer, Floating, Overlay, Mobile Interstitial, and more.</span>
            </div>
          </div>

          {/* Ad spaces list */}
          {categories.length === 0 ? (
            <div className="border-t border-zinc-700 px-5 py-8 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Plus className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300 mb-1">No ad spaces yet</p>
                <p className="text-xs text-zinc-600">Add your first ad space to start serving ads on your site.</p>
              </div>
              <button
                onClick={onAddSpace}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-blue-700 text-blue-400 hover:bg-blue-950 hover:border-blue-500 text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Ad Space
              </button>
            </div>
          ) : (
            <>
              {/* Spaces list with delete buttons */}
              <div className="border-t border-zinc-700">
                <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-700">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    {categories.length} Ad Space{categories.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={onAddSpace}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Add Space
                  </button>
                </div>
                <div className="divide-y divide-zinc-800">
                  {categories.map((cat: any, idx: any) => {
                    const earning = earningsSummary?.categories?.find(e => e.categoryId?.toString() === cat._id?.toString());
                    return (
                      <div key={cat._id} className="px-5 py-3 flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-zinc-200">{cat.categoryName || cat.spaceType}</span>
                            <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded capitalize">{cat.spaceType}</span>
                            {AUTO_RELIABLE.includes((cat.spaceType || '').toLowerCase()) && (
                              <span className="text-xs text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">auto</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-600">
                            {earning?.available ? (
                              <span className="text-green-400">RWF {Number(earning.ownerEarns).toLocaleString()}/mo</span>
                            ) : (
                              <span className="italic">earnings pending traffic</span>
                            )}
                            <span>{cat.userCount} user{cat.userCount !== 1 ? 's' : ''}</span>
                            <span className="capitalize">{cat.defaultLanguage || currentLabel}</span>
                          </div>
                        </div>
                        {onSendInvite && (
                          <button
                            onClick={() => onSendInvite(cat)}
                            title="Email someone a link to advertise on this space"
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-emerald-950 text-zinc-500 hover:text-emerald-400 transition-all border border-zinc-700 hover:border-emerald-900 shrink-0"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Invite</span>
                          </button>
                        )}
                        {onDeleteCategory && (
                          <button
                            onClick={() => onDeleteCategory(cat)}
                            title="Delete ad space"
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-red-950 text-zinc-500 hover:text-red-400 transition-all border border-zinc-700 hover:border-red-900 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Precise-placement spaces (accordion) — iframe embeds */}
              {embedCategories.length > 0 && (
                <div className="border-t border-zinc-700">
                  <button
                    onClick={() => setShowManual(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-zinc-100">Precise-Placement Spaces</span>
                      <span className="text-xs text-zinc-500 ml-1">— iframe embed, paste exactly where you want the ad</span>
                    </div>
                    {showManual ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  </button>
                  {showManual && (
                    <div className="px-5 pb-5 space-y-4">
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        These spaces (sidebar, in-feed, inline content, etc.) can't be reliably auto-placed by the main
                        script, so they use a self-contained <strong className="text-zinc-300">iframe</strong> instead —
                        no script needed, and it can't be wiped out by React/Vue re-renders the way an injected div can.
                        Paste the matching tag exactly where you want that ad to appear.
                      </p>
                      <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                        {embedCategories.map((cat: any, idx: any) => {
                          const embedSrc = `${BACKEND}/api/p/embed/${cat._id}`;
                          return (
                            <div key={cat._id} className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-mono">{idx + 1}.</span>
                                <span className="text-xs font-semibold text-zinc-300">{cat.categoryName || cat.spaceType}</span>
                                <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">{cat.spaceType}</span>
                              </div>
                              <CodeBlock code={buildIframeEmbed(framework, embedSrc, cat.spaceType)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="border-t border-zinc-700 px-5 py-3 flex items-start gap-2 bg-zinc-950">
            <Info className="w-3 h-3 text-zinc-500 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-500">
              Select your framework above to see the right code. The main script auto-places Header, Floating, Overlay,
              Modal, Mobile Interstitial, Bottom and Footer spaces — nothing else to do for those.
              {embedCategories.length > 0 && ' For the rest, expand "Precise-Placement Spaces" and paste the iframe where you want each ad.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const CodeDisplay = () => null;
export default CodeDisplay;
