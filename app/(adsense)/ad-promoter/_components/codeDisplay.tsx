'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { Copy, Check, Plus, Code, Info, Zap, MousePointer, Globe, Trash2, X, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';

const AUTO_RELIABLE = [
  'header','floating','overlay','modalpic',
  'mobile interstitial','bottom','profooter'
];

// ── All supported framework formats ──────────────────────────────────────────
const FRAMEWORKS = [
  { id: 'html',       label: 'HTML',            icon: '🌐' },
  { id: 'react',      label: 'React / CRA',     icon: '⚛️' },
  { id: 'nextjs',     label: 'Next.js',         icon: '▲' },
  { id: 'vue',        label: 'Vue.js',          icon: '💚' },
  { id: 'nuxt',       label: 'Nuxt.js',         icon: '💚' },
  { id: 'svelte',     label: 'Svelte / SvelteKit', icon: '🔥' },
  { id: 'angular',    label: 'Angular',         icon: '🔴' },
  { id: 'gatsby',     label: 'Gatsby',          icon: '💜' },
  { id: 'remix',      label: 'Remix',           icon: '💿' },
  { id: 'astro',      label: 'Astro',           icon: '🚀' },
  { id: 'wordpress',  label: 'WordPress',       icon: '📝' },
  { id: 'php',        label: 'PHP',             icon: '🐘' },
  { id: 'django',     label: 'Django',          icon: '🐍' },
  { id: 'flask',      label: 'Flask',           icon: '🍶' },
  { id: 'vanillajs',  label: 'Vanilla JS',      icon: '🟨' },
];

const HUMAN_LANGUAGES = [
  { value: 'english',     label: 'English' },
  { value: 'french',      label: 'French (Français)' },
  { value: 'kinyarwanda', label: 'Kinyarwanda' },
  { value: 'kiswahili',   label: 'Swahili' },
  { value: 'chinese',     label: 'Chinese (中文)' },
  { value: 'spanish',     label: 'Spanish (Español)' },
];

// ── Build the main site script for each framework ────────────────────────────
function buildSiteScript(src, framework) {
  switch (framework) {
    case 'react':
      return `// In your root component (e.g. App.js or index.js)
import { useEffect } from 'react';

function YepperScript() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${src}';
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);
  return null;
}

// Then use <YepperScript /> once at the top level of your app:
// function App() {
//   return (
//     <>
//       <YepperScript />
//       {/* rest of your app */}
//     </>
//   );
// }`;

    case 'nextjs':
      return `// Option A — app/layout.js (App Router, Next.js 13+)
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

// Option B — pages/_document.js (Pages Router)
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

    case 'vue':
      return `// In src/main.js  OR  in your root App.vue <script setup>
// main.js approach:
const script = document.createElement('script');
script.src = '${src}';
script.async = true;
document.head.appendChild(script);

// ─── OR App.vue approach ───────────────────────────────
// <script setup>
// import { onMounted } from 'vue';
// onMounted(() => {
//   const s = document.createElement('script');
//   s.src = '${src}';
//   s.async = true;
//   document.head.appendChild(s);
// });
// </script>`;

    case 'nuxt':
      return `// nuxt.config.js / nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        { src: '${src}', async: true }
      ]
    }
  }
})

// ─── OR in a page/layout using useHead ────────────────
// <script setup>
// useHead({
//   script: [{ src: '${src}', async: true }]
// });
// </script>`;

    case 'svelte':
      return `<!-- SvelteKit: src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  onMount(() => {
    const s = document.createElement('script');
    s.src = '${src}';
    s.async = true;
    document.head.appendChild(s);
  });
</script>

<!-- Svelte (plain): just add to your index.html -->
<!-- <script src="${src}" async></script> -->`;

    case 'angular':
      return `// angular.json → projects → architect → build → options → scripts
// "scripts": ["${src}"]

// ─── OR in index.html ────────────────────────────────
// <script src="${src}" async></script>

// ─── OR programmatically in AppComponent ─────────────
// import { Component, OnInit, Renderer2, Inject } from '@angular/core';
// import { DOCUMENT } from '@angular/common';
// @Component({ selector: 'app-root', templateUrl: './app.component.html' })
// export class AppComponent implements OnInit {
//   constructor(private renderer: Renderer2, @Inject(DOCUMENT) private document: Document) {}
//   ngOnInit() {
//     const s = this.renderer.createElement('script');
//     s.src = '${src}'; s.async = true;
//     this.renderer.appendChild(this.document.head, s);
//   }
// }`;

    case 'gatsby':
      return `// gatsby-browser.js (create this in your project root if it doesn't exist)
export const onClientEntry = () => {
  const script = document.createElement('script');
  script.src = '${src}';
  script.async = true;
  document.head.appendChild(script);
};

// ─── OR use gatsby-plugin-load-script ─────────────────
// Install: npm install gatsby-plugin-load-script
// In gatsby-config.js:
// plugins: [{ resolve: 'gatsby-plugin-load-script', options: { src: '${src}' } }]`;

    case 'remix':
      return `// app/root.tsx — add to the <head> via Links or Scripts export
import { Scripts, ScrollRestoration } from "@remix-run/react";

export default function App() {
  return (
    <html>
      <head>
        {/* other head elements */}
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <script src="${src}" async />
        <Scripts />
      </body>
    </html>
  );
}`;

    case 'astro':
      return `---
// src/layouts/Layout.astro
---
<html>
  <head>
    <!-- other head elements -->
    <script src="${src}" async is:inline></script>
  </head>
  <body>
    <slot />
  </body>
</html>`;

    case 'wordpress':
      return `<?php
// Add to your theme's functions.php

function yepper_enqueue_script() {
    wp_enqueue_script(
        'yepper-ads',
        '${src}',
        array(),   // no dependencies
        null,      // no version (script auto-updates)
        false      // load in <head>
    );
    // Make it async
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
// In your main PHP template (header.php, layout.php, etc.)
$yepper_script = '<script src="${src}" async></script>';
echo $yepper_script;
?>

<!-- Or directly in HTML: -->
<script src="${src}" async></script>`;

    case 'django':
      return `{# In your base template (base.html or _base.html) #}
{% block head %}
  <script src="${src}" async></script>
{% endblock %}

{# ─── OR using django-compressor / static files ─── #}
{# {% load static %} #}
{# <script src="{% static 'js/yepper.js' %}" async></script> #}
{# (download the script and put it in your static folder) #}`;

    case 'flask':
      return `{# In your base Jinja2 template (base.html) #}
<!DOCTYPE html>
<html>
<head>
  <script src="${src}" async></script>
</head>
<body>
  {% block content %}{% endblock %}
</body>
</html>`;

    case 'vanillajs':
      return `// Dynamically load (recommended — load after DOM is ready)
document.addEventListener('DOMContentLoaded', function() {
  var s = document.createElement('script');
  s.src = '${src}';
  s.async = true;
  document.head.appendChild(s);
});`;

    default: // html
      return `<script src="${src}" async></script>`;
  }
}

// ── Build manual placement div for each framework ────────────────────────────
function buildManualDiv(spaceId, framework) {
  switch (framework) {
    case 'react':
    case 'nextjs':
    case 'gatsby':
    case 'remix':
      return `{/* Place this div exactly where you want the ad */}
<div data-yepper-space="${spaceId}"></div>`;
    case 'vue':
    case 'nuxt':
    case 'svelte':
    case 'astro':
      return `<!-- Place this div exactly where you want the ad -->
<div data-yepper-space="${spaceId}"></div>`;
    case 'angular':
      return `<!-- In your Angular template (.component.html) -->
<div data-yepper-space="${spaceId}"></div>`;
    case 'wordpress':
    case 'php':
      return `<?php echo '<div data-yepper-space="${spaceId}"></div>'; ?>
<!-- Or directly: -->
<div data-yepper-space="${spaceId}"></div>`;
    case 'django':
      return `{# Django/Jinja2 template #}
<div data-yepper-space="${spaceId}"></div>`;
    case 'flask':
      return `{# Jinja2 template #}
<div data-yepper-space="${spaceId}"></div>`;
    case 'vanillajs':
      return `<!-- HTML -->
<div data-yepper-space="${spaceId}"></div>

// Or create it with JS:
const el = document.createElement('div');
el.dataset.yepperSpace = '${spaceId}';
document.querySelector('#your-container').appendChild(el);`;
    default:
      return `<div data-yepper-space="${spaceId}"></div>`;
  }
}

// ── Step-by-step instructions per framework ───────────────────────────────────
function getInstallSteps(framework, src) {
  const steps = {
    html: [
      'Open your HTML file (e.g. index.html).',
      'Find the <head> section.',
      'Paste the script tag anywhere inside <head> — or just before </body>.',
      'Save and reload your site. That\'s it!',
    ],
    react: [
      'Create a small YepperScript component (see code above) in your project.',
      'Import and place <YepperScript /> once in your root App component.',
      'The script loads once when the app mounts and is cleaned up on unmount.',
      'For manual ad spaces, place the <div data-yepper-space="..."> in any JSX.',
    ],
    nextjs: [
      'Use the <Script> component from "next/script" — it\'s built-in, no install needed.',
      'For App Router: add it to app/layout.js (root layout) with strategy="afterInteractive".',
      'For Pages Router: add to pages/_document.js inside <Head>.',
      'For manual spaces, drop <div data-yepper-space="..."> in any page or component JSX.',
      'The script auto-loads on every page because it\'s in the root layout.',
    ],
    vue: [
      'Open src/main.js (or main.ts).',
      'Add the script creation code before app.mount().',
      'Or add it inside the onMounted() hook in your root App.vue.',
      'For manual spaces, add <div data-yepper-space="..."> in any .vue template.',
    ],
    nuxt: [
      'Open nuxt.config.js (or nuxt.config.ts).',
      'Add the script to app.head.script array (see code above).',
      'This automatically adds the script to every page.',
      'For manual spaces, add <div data-yepper-space="..."> in any page or layout template.',
    ],
    svelte: [
      'Open src/routes/+layout.svelte (SvelteKit) or your root Svelte file.',
      'Add the onMounted script loader inside a <script> block.',
      'For plain Svelte, you can add the tag directly to your index.html.',
      'For manual spaces, add <div data-yepper-space="..."> in any .svelte template.',
    ],
    angular: [
      'Preferred: add it programmatically in AppComponent\'s ngOnInit() using Renderer2.',
      'Or add the script src directly to the scripts array in angular.json.',
      'Or add it to src/index.html inside <head>.',
      'For manual spaces, add <div data-yepper-space="..."> in any component template.',
    ],
    gatsby: [
      'Create gatsby-browser.js in your project root (if it doesn\'t exist).',
      'Add the onClientEntry export (see code above).',
      'This ensures the script loads after Gatsby\'s client-side hydration.',
      'Alternatively, install gatsby-plugin-load-script (npm install).',
      'For manual spaces, add <div data-yepper-space="..."> in any JSX component.',
    ],
    remix: [
      'Open app/root.tsx (the root layout).',
      'Add <script src="..." async /> inside the <body>, after <Scripts />.',
      'This ensures it loads on every route.',
      'For manual spaces, add <div data-yepper-space="..."> in any route component.',
    ],
    astro: [
      'Open your root layout file (e.g. src/layouts/Layout.astro).',
      'Add <script src="..." async is:inline></script> inside <head>.',
      'The is:inline directive prevents Astro from bundling it.',
      'For manual spaces, add <div data-yepper-space="..."> in any .astro component.',
    ],
    wordpress: [
      'Open your active theme\'s functions.php (Appearance → Theme Editor in WP Admin).',
      'Paste the PHP snippet at the end of functions.php.',
      'The script will load on every front-end page of your site.',
      'For manual spaces, add the PHP echo div in your theme templates.',
      'Or use a widget/shortcode plugin to insert divs in specific locations.',
    ],
    php: [
      'Open your main PHP layout file (header.php, layout.php, base.php, etc.).',
      'Paste the script tag (echo or raw HTML) inside <head>.',
      'It will load on every page that includes this layout.',
      'For manual spaces, echo the div PHP tag in any template where you want an ad.',
    ],
    django: [
      'Open your base Django template (usually base.html or _base.html).',
      'Add the script tag inside the {% block head %} block.',
      'Child templates that extend base.html will automatically get the script.',
      'For manual spaces, add <div data-yepper-space="..."> in any template.',
    ],
    flask: [
      'Open your base Jinja2 template (base.html).',
      'Add <script src="..." async></script> inside <head>.',
      'All templates that extend base.html will automatically include it.',
      'For manual spaces, add <div data-yepper-space="..."> in any template.',
    ],
    vanillajs: [
      'Add the JavaScript snippet to any existing JS file that runs on page load.',
      'Or add it directly as a <script> tag in your HTML.',
      'The DOMContentLoaded listener ensures the script loads after the page is ready.',
      'For manual spaces, add <div data-yepper-space="..."> in your HTML.',
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
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all border border-zinc-700 shrink-0"
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

// ── Framework selector pills ──────────────────────────────────────────────────
const FrameworkPicker = ({ active, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {FRAMEWORKS.map(f => (
      <button
        key={f.id}
        onClick={() => onChange(f.id)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          active === f.id
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
        }`}
      >
        <span>{f.icon}</span>
        <span>{f.label}</span>
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
export const MasterIntegration = ({ website, categories = [], onAddSpace, onLanguageChange, onDeleteCategory, onEditLanguage, onEditUserCount, earningsSummary, scriptInstalled = false }) => {
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

  const mainCode   = buildSiteScript(rawSrc, framework);
  const currentLabel = HUMAN_LANGUAGES.find(l => l.value === humanLang)?.label || 'English';

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
        <span className={`text-zinc-500 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
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
              <span className="text-zinc-600">— all spaces will serve ads in:</span>
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
                {langSaved ? <><Check className="w-3 h-3" /> Saved</> : 'Apply to All Spaces'}
              </button>
            </div>
          </div>

          {/* Main script section */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-100">
                Main Site Script — paste this <strong>once</strong> on every page
              </h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This single script handles <strong className="text-zinc-300">all</strong> your ad spaces automatically.
              You only ever need one copy of it across your entire site. Never change it when you add more spaces.
            </p>

            <CodeBlock code={mainCode} />
            <InstallSteps framework={framework} src={rawSrc} />

            <div className="bg-blue-950 border border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-300">
              ⚡ Works for all auto-placed spaces: Header, Footer, Floating, Overlay, Mobile Interstitial, and more.
            </div>

            <button
              onClick={onAddSpace}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-blue-700 text-blue-400 hover:bg-blue-950 hover:border-blue-500 text-xs font-medium transition-all"
            >
              <Plus className="w-3 h-3" /> {scriptInstalled ? 'Add Auto Space' : 'Install script first'}
            </button>
          </div>

          {/* Manual placement divs */}
          {categories.length > 0 && (
            <div className="border-t border-zinc-700">
              <button
                onClick={() => setShowManual(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MousePointer className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-zinc-100">Manual Placement Divs</span>
                  <span className="text-xs text-zinc-500 ml-1">— paste where you want exact placement</span>
                </div>
                {showManual ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
              </button>

              {showManual && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    For spaces that need <strong className="text-zinc-300">exact placement</strong>, also paste the matching div
                    at that exact location in your code. The main script above must still be present.
                  </p>
                  <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                    {categories.map((cat: any, idx: any) => {
                      const code = buildManualDiv(cat._id, framework);
                      return (
                        <div key={cat._id} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 font-mono">{idx + 1}.</span>
                            <span className="text-xs font-semibold text-zinc-300">{cat.categoryName || cat.spaceType}</span>
                            <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">{cat.spaceType}</span>
                            {AUTO_RELIABLE.includes((cat.spaceType || '').toLowerCase()) && (
                              <span className="text-xs text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">auto-ok</span>
                            )}
                            {onDeleteCategory && (
                              <button
                                onClick={(e: any) => { e.stopPropagation(); onDeleteCategory(cat); }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 transition-all border border-red-900 shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <CodeBlock code={code} />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={onAddSpace}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-purple-700 text-purple-400 hover:bg-purple-950 hover:border-purple-500 text-xs font-medium transition-all"
                  >
                    <Plus className="w-3 h-3" /> Add Manual Space
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Spaces summary strip */}
          {categories.length > 0 && (
            <div className="border-t border-zinc-700 px-5 py-3 bg-zinc-950">
              <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
                {categories.length} Ad Space{categories.length !== 1 ? 's' : ''} on this site
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const earning = earningsSummary?.categories?.find(e => e.categoryId?.toString() === cat._id?.toString());
                  return (
                    <div
                      key={cat._id}
                      className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs group"
                    >
                      <span className="font-semibold text-zinc-200">{cat.categoryName || cat.spaceType}</span>
                      <span className="text-zinc-600">·</span>
                      {earning?.available ? (
                        <span className="text-green-400 font-medium">RWF {Number(earning.ownerEarns).toLocaleString()}/mo</span>
                      ) : (
                        <span className="text-zinc-500 italic">earnings pending traffic</span>
                      )}
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-400">{cat.userCount} user{cat.userCount !== 1 ? 's' : ''}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-500 capitalize">{cat.defaultLanguage || currentLabel}</span>
                      {onDeleteCategory && (
                        <button
                          onClick={() => onDeleteCategory(cat)}
                          className="ml-1 opacity-0 group-hover:opacity-100 flex items-center justify-center w-4 h-4 rounded text-red-500 hover:text-red-400 hover:bg-red-950 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer tip */}
          <div className="border-t border-zinc-700 px-5 py-3 flex items-start gap-2 bg-zinc-950">
            <Info className="w-3 h-3 text-zinc-500 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-500">
              Select your framework above to see the right code for your stack.
              The main script handles everything automatically. For spaces that need exact placement,
              expand "Manual Placement Divs" and paste the relevant div. New spaces are picked up
              automatically — no need to update the main script.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const CodeDisplay = () => null;
export default CodeDisplay;