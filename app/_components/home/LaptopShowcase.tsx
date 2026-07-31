'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion';

// Real, editorial-grade photography (Unsplash) standing in for a publisher's
// actual site — the point of this section is "here's what your ad looks
// like sitting on a real page," so the mock page has to look like somewhere
// a person would actually stop and read, not a gray wireframe.
const HERO_PHOTO = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1400&auto=format&fit=crop';
const CARD_PHOTOS = [
  { src: 'https://images.unsplash.com/photo-1694458557352-4b8ca744dea7?q=80&w=600&auto=format&fit=crop', caption: 'Weekend brunch spots trending across the city' },
  { src: 'https://images.unsplash.com/photo-1564844536308-75c540dbf14e?q=80&w=600&auto=format&fit=crop', caption: 'Local bakery wins national award' },
  { src: 'https://images.unsplash.com/photo-1502741384106-56538427cde9?q=80&w=600&auto=format&fit=crop', caption: 'Tariffs squeeze specialty grocers nationwide' },
];

const ease = [0.16, 1, 0.3, 1] as const;

const laptopIn: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

const screenStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
};

// Three real Yepper ad-space types (see app/_lib/ad-spaces.ts) — one
// publisher page, three different advertisers, each booked into a
// different placement, cycling to show the variety of ads a single page
// can carry at once.
const ADS = {
  floating: {
    label: 'Floating ad',
    photo: 'https://images.unsplash.com/photo-1748944079305-8d2a86e7ad32?q=80&w=500&auto=format&fit=crop',
    name: 'Precision Manufacturing',
    brand: 'Ironline Industrial',
    cta: 'Get a quote →',
  },
  header: {
    label: 'Header ad',
    photo: 'https://images.unsplash.com/photo-1757889692998-d851b95f912e?q=80&w=500&auto=format&fit=crop',
    name: 'Poolside Suites, Ocean View',
    brand: 'The Meridian Hotel',
    cta: 'Reserve now →',
  },
  modal: {
    label: 'Modal ad',
    photo: 'https://images.unsplash.com/photo-1764591696226-ea4e8d655bc7?q=80&w=500&auto=format&fit=crop',
    name: 'Business Banking, Simplified',
    brand: 'Crestline Bank',
    cta: 'Open an account →',
  },
} as const;

const PLACEMENTS = ['floating', 'header', 'modal'] as const;
type Placement = (typeof PLACEMENTS)[number];
const CYCLE_MS = 3200;

function FloatingAd() {
  const ad = ADS.floating;
  return (
    <motion.div
      key="floating"
      initial={{ opacity: 0, scale: 0.7, y: 18, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: -3 }}
      exit={{ opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 280, damping: 20 }}
      className="absolute -right-3 bottom-10 sm:-right-8 sm:bottom-16 w-32 sm:w-44 z-10"
    >
      <div className="yp-float rounded-xl sm:rounded-2xl bg-white p-2 sm:p-2.5 shadow-[0_18px_40px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
        <div className="relative rounded-lg overflow-hidden aspect-[4/3]">
          <Image src={ad.photo} alt="" fill sizes="180px" className="object-cover" />
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[7px] sm:text-[8px] font-bold text-white uppercase tracking-wide">
            {ad.label}
          </span>
        </div>
        <div className="pt-1.5 sm:pt-2 px-0.5">
          <p className="text-[9px] sm:text-[11px] font-bold text-[#1F1B16] leading-tight truncate">{ad.name}</p>
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <span className="text-[8px] sm:text-[9px] text-black/45 truncate">{ad.brand}</span>
            <span className="shrink-0 text-[8px] sm:text-[10px] font-bold text-coral">{ad.cta}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HeaderAd() {
  const ad = ADS.header;
  return (
    <motion.div
      key="header"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ duration: 0.32, ease }}
      className="absolute inset-x-3 sm:inset-x-5 top-[30px] sm:top-[34px] z-20 flex items-center gap-1.5 sm:gap-2.5 pl-1.5 pr-2 sm:pl-2 sm:pr-3 py-1.5 rounded-md bg-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
    >
      <span className="shrink-0 px-1.5 py-0.5 rounded bg-black/70 text-[6px] sm:text-[7px] font-bold text-white uppercase tracking-wide">
        {ad.label}
      </span>
      <div className="relative w-6 h-6 sm:w-8 sm:h-8 rounded overflow-hidden shrink-0">
        <Image src={ad.photo} alt="" fill sizes="40px" className="object-cover" />
      </div>
      <p className="min-w-0 flex-1 text-[8px] sm:text-[10px] font-bold text-[#1F1B16] truncate">
        {ad.name} <span className="font-medium text-black/45">— {ad.brand}</span>
      </p>
      <span className="shrink-0 text-[8px] sm:text-[10px] font-bold text-coral">{ad.cta}</span>
    </motion.div>
  );
}

function ModalAd() {
  const ad = ADS.modal;
  return (
    <motion.div
      key="modal"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/45"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.28 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative w-[70%] sm:w-[52%] rounded-lg sm:rounded-xl bg-white shadow-2xl overflow-hidden"
      >
        <span className="absolute top-1 right-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-black/55 text-white text-[8px] leading-none">
          &times;
        </span>
        <div className="relative aspect-[4/3]">
          <Image src={ad.photo} alt="" fill sizes="220px" className="object-cover" />
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-[6px] sm:text-[7px] font-bold text-white uppercase tracking-wide">
            {ad.label}
          </span>
        </div>
        <div className="p-2 sm:p-2.5">
          <p className="text-[9px] sm:text-[11px] font-bold text-[#1F1B16] leading-tight truncate">{ad.name}</p>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className="text-[8px] sm:text-[9px] text-black/45 truncate">{ad.brand}</span>
            <span className="shrink-0 text-[8px] sm:text-[10px] font-bold text-coral">{ad.cta}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LaptopShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.25 });

  const [placementIndex, setPlacementIndex] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setPlacementIndex((n) => (n + 1) % PLACEMENTS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [inView]);
  const placement: Placement | null = inView ? PLACEMENTS[placementIndex] : null;

  return (
    <section className="relative -mt-16 sm:-mt-24 pb-10 sm:pb-14">
      <motion.div
        ref={containerRef}
        className="relative mx-auto max-w-3xl px-3 sm:px-8"
        style={{ perspective: 1400 }}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      >
        <motion.div variants={laptopIn} className="relative">
          {/* ── Screen ─────────────────────────────────────────────── */}
          <div
            className="relative rounded-[22px] bg-[#141416] p-2.5 sm:p-3.5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)]"
            style={{ transform: 'rotateX(6deg)', transformOrigin: '50% 100%' }}
          >
            <div aria-hidden className="absolute left-1/2 top-1.5 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#3a3a3d]" />

            <motion.div
              variants={screenStagger}
              className="relative rounded-[10px] overflow-hidden bg-white aspect-[16/10]"
            >
              {/* Browser chrome */}
              <motion.div variants={rise} className="h-7 sm:h-8 flex items-center gap-2 px-3 bg-[#F3F2EE] border-b border-black/5">
                <span className="w-2 h-2 rounded-full bg-[#f87171]" />
                <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                <span className="ml-2 flex-1 max-w-[220px] h-4 rounded-full bg-white border border-black/5 flex items-center px-2.5 text-[9px] sm:text-[10px] text-black/40 truncate">
                  newswebsite.com
                </span>
              </motion.div>

              {/* Mock site body */}
              <div className="relative h-[calc(100%-1.75rem)] sm:h-[calc(100%-2rem)] overflow-hidden">
                {/* Masthead nav */}
                <motion.div variants={rise} className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5">
                  <span className="text-[11px] sm:text-sm font-bold font-(--font-display) text-[#1F1B16] tracking-tight">
                    News Website
                  </span>
                  <div className="hidden sm:flex items-center gap-3 text-[9px] text-black/45 font-medium">
                    <span>World</span>
                    <span>Business</span>
                    <span>Markets</span>
                  </div>
                </motion.div>

                {/* Hero photo with baked-in headline */}
                <motion.div variants={rise} className="relative mx-3 sm:mx-5 rounded-lg overflow-hidden aspect-[16/7]">
                  <Image
                    src={HERO_PHOTO}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 620px, 90vw"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-4">
                    <p className="text-white font-(--font-display) font-bold text-[13px] sm:text-xl leading-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
                      Grocery prices climb as supply chains tighten.
                    </p>
                    <p className="hidden sm:block text-white/80 text-[10px] mt-0.5">What it means for shoppers this quarter.</p>
                  </div>
                </motion.div>

                {/* More-stories row — fixed-height strip (not aspect-driven)
                    so it reliably fits inside the screen's 16:10 box
                    regardless of viewport width; captions sit on the image,
                    same treatment as the hero, instead of taking their own
                    line. */}
                <motion.div variants={rise} className="hidden sm:flex gap-2 px-5 pt-3">
                  {CARD_PHOTOS.map((c) => (
                    <div key={c.caption} className="relative flex-1 h-14 sm:h-16 rounded-md overflow-hidden">
                      <Image src={c.src} alt="" fill sizes="180px" className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      <p className="absolute bottom-1 left-1.5 right-1.5 text-[7px] sm:text-[8px] font-semibold text-white truncate [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                        {c.caption}
                      </p>
                    </div>
                  ))}
                </motion.div>

                {/* Header + modal placements live inside the page body, same
                    stacking context as the content they sit over. */}
                <AnimatePresence>
                  {placement === 'header' && <HeaderAd />}
                  {placement === 'modal' && <ModalAd />}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* ── Hinge + base ───────────────────────────────────────── */}
          <div aria-hidden className="h-1 sm:h-1.5 bg-gradient-to-b from-[#0c0c0d] to-[#2a2a2d]" />
          <div
            aria-hidden
            className="relative h-3 sm:h-4 bg-gradient-to-b from-[#d8d8dc] to-[#a9a9ae]"
            style={{ clipPath: 'polygon(-4% 0%, 104% 0%, 96% 100%, 4% 100%)' }}
          >
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-14 sm:w-20 h-1 sm:h-1.5 rounded-b-md bg-black/15" />
          </div>
          <div aria-hidden className="mx-auto mt-3 h-4 sm:h-6 w-[70%] rounded-full bg-black/25 blur-xl" />

          {/* Floating placement pops off the laptop's own corner, outside
              the screen bezel — it's meant to float over the whole page. */}
          <AnimatePresence>{placement === 'floating' && <FloatingAd />}</AnimatePresence>
        </motion.div>
      </motion.div>
    </section>
  );
}
