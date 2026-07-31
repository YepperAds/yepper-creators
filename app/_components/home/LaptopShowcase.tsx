'use client';

import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import SectionIntro from './SectionIntro';

// Real, editorial-grade food photography (Unsplash) standing in for a
// publisher's actual site — the point of this section is "here's what your
// ad looks like sitting on a real page," so the mock page has to look like
// somewhere a person would actually stop and read, not a gray wireframe.
const HERO_PHOTO = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1400&auto=format&fit=crop';
const CARD_PHOTOS = [
  { src: 'https://images.unsplash.com/photo-1694458557352-4b8ca744dea7?q=80&w=600&auto=format&fit=crop', caption: 'Golden pancake stack' },
  { src: 'https://images.unsplash.com/photo-1564844536308-75c540dbf14e?q=80&w=600&auto=format&fit=crop', caption: 'Midnight chocolate cake' },
  { src: 'https://images.unsplash.com/photo-1502741384106-56538427cde9?q=80&w=600&auto=format&fit=crop', caption: 'A well-stocked pantry' },
];
const AD_PHOTO = 'https://images.unsplash.com/photo-1757801333069-f7b3cabaec4a?q=80&w=500&auto=format&fit=crop';

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

const adIn: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 18, rotate: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotate: -3,
    transition: { type: 'spring', stiffness: 280, damping: 20, delay: 0.55 },
  },
};

export default function LaptopShowcase() {
  return (
    <section className="relative pt-4 pb-4 sm:pb-8">
      <SectionIntro
        eyebrow="See it live"
        title="This is what your ad looks like."
        body="Not a banner farm. A real placement on a real page — the same page a publisher's actual readers see."
        accent="blue"
      />

      <motion.div
        className="relative mx-auto max-w-3xl px-2 pb-10 sm:pb-14"
        style={{ perspective: 1400 }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
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
                  thymeandtable.com
                </span>
              </motion.div>

              {/* Mock site body */}
              <div className="relative h-[calc(100%-1.75rem)] sm:h-[calc(100%-2rem)] overflow-hidden">
                {/* Masthead nav */}
                <motion.div variants={rise} className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5">
                  <span className="text-[11px] sm:text-sm font-bold font-(--font-display) text-[#1F1B16] tracking-tight">
                    Thyme &amp; Table
                  </span>
                  <div className="hidden sm:flex items-center gap-3 text-[9px] text-black/45 font-medium">
                    <span>Recipes</span>
                    <span>Baking</span>
                    <span>Journal</span>
                  </div>
                </motion.div>

                {/* Hero photo with baked-in title */}
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
                      Recipes worth the mess.
                    </p>
                    <p className="hidden sm:block text-white/80 text-[10px] mt-0.5">Slow weekends, fast weeknights.</p>
                  </div>
                </motion.div>

                {/* Recipe card row — fixed-height strip (not aspect-driven) so it
                    reliably fits inside the screen's 16:10 box regardless of
                    viewport width; captions sit on the image, same treatment
                    as the hero, instead of taking their own line. */}
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

          {/* ── Floating ad, popped off the corner of the browser ──── */}
          <motion.div
            variants={adIn}
            className="absolute -right-3 bottom-10 sm:-right-8 sm:bottom-16 w-32 sm:w-44 z-10"
          >
            <div className="yp-float rounded-xl sm:rounded-2xl bg-white p-2 sm:p-2.5 shadow-[0_18px_40px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
              <div className="relative rounded-lg overflow-hidden aspect-[4/3]">
                <Image src={AD_PHOTO} alt="" fill sizes="180px" className="object-cover" />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[7px] sm:text-[8px] font-bold text-white uppercase tracking-wide">
                  Ad
                </span>
              </div>
              <div className="pt-1.5 sm:pt-2 px-0.5">
                <p className="text-[9px] sm:text-[11px] font-bold text-[#1F1B16] leading-tight truncate">Cold-Pressed Olive Oil</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[8px] sm:text-[9px] text-black/45">Olivera</span>
                  <span className="text-[8px] sm:text-[10px] font-bold text-coral">Shop now →</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
