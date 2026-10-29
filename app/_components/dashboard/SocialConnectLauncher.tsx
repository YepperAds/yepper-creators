'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, Link2Icon, XIcon } from 'lucide-react';

const SOCIALS = [
  { name: 'YouTube', src: '/socials-icon/youtube-icon.png' },
  { name: 'Instagram', src: '/socials-icon/instagram-icon.png' },
  { name: 'TikTok', src: '/socials-icon/tiktok-icon.png' },
  { name: 'Facebook', src: '/socials-icon/facebook-icon.png' },
];

export default function SocialConnectLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeSocial, setActiveSocial] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveSocial(null);
      return;
    }

    let index = 0;
    const begin = window.setTimeout(() => setActiveSocial(0), 450);
    const cycle = window.setInterval(() => {
      index += 1;
      if (index >= SOCIALS.length) {
        index = -1;
        setActiveSocial(null);
      } else {
        setActiveSocial(index);
      }
    }, 1250);

    return () => {
      window.clearTimeout(begin);
      window.clearInterval(cycle);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-[#171717]/95 py-2 pl-3 pr-3.5 text-xs font-semibold text-white shadow-xl shadow-black/40 backdrop-blur transition hover:border-white/20 hover:bg-[#222] sm:gap-3 sm:py-2.5 sm:pl-4 sm:pr-5"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Link2Icon className="h-4 w-4 shrink-0 text-white/80" aria-hidden="true" />
        <span className="hidden sm:inline">Connect socials</span>
        <span className="flex -space-x-2" aria-hidden="true">
          {SOCIALS.map((social) => (
            <span key={social.name} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-[#171717] bg-white sm:h-8 sm:w-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={social.src} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="social-connect-title"
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#111] p-6 text-white shadow-2xl shadow-black/60 sm:p-8"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
              aria-label="Close dialog"
            >
              <XIcon className="h-4 w-4" />
            </button>

            <div className="relative mx-auto mb-6 flex h-32 w-56 items-center justify-center">
              <div className="absolute inset-5 rounded-full border border-dashed border-white/15" />
              <div className="absolute inset-10 rounded-full bg-cyan-400/10 blur-2xl" />
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#191919] p-2 shadow-xl shadow-black/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/yepper-logo.png" alt="Yepper" className="h-auto w-full object-contain" />
                <AnimatePresence>
                  {activeSocial !== null && (
                    <motion.span
                      key="connected-check"
                      initial={{ scale: 0, opacity: 0, rotate: -25 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.65, opacity: 0, rotate: 15 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 24, delay: 0.42 }}
                      className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#111] bg-emerald-400 text-[#062b1a] shadow-lg shadow-emerald-500/30"
                    >
                      <CheckIcon className="h-4 w-4" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {SOCIALS.map((social, index) => {
                const positions = [
                  { className: 'left-5 top-2', x: 72, y: 42 },
                  { className: 'right-5 top-2', x: -72, y: 42 },
                  { className: 'right-5 bottom-2', x: -72, y: -42 },
                  { className: 'left-5 bottom-2', x: 72, y: -42 },
                ];
                const position = positions[index];
                const isActive = activeSocial === index;
                return (
                  <motion.span
                    key={social.name}
                    initial={false}
                    animate={{
                      x: isActive ? position.x : 0,
                      y: isActive ? position.y : 0,
                      scale: isActive ? 0.35 : 1,
                      opacity: isActive ? 0 : 1,
                      zIndex: isActive ? 30 : 10,
                    }}
                    transition={{
                      x: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      y: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      scale: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.4, delay: isActive ? 0.15 : 0 },
                    }}
                    className={`absolute ${position.className} flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white shadow-lg shadow-black/30`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={social.src} alt={social.name} className="h-full w-full object-cover" />
                  </motion.span>
                );
              })}
            </div>

            <div className="text-center">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">Your creator hub</p>
              <h2 id="social-connect-title" className="text-xl font-bold sm:text-2xl">Connect Yepper with your socials</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/60">
                Bring your YouTube and TikTok presence into one place. Connect an account, manage your channels, and let advertisers discover your creator content on Yepper.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
              <ol className="space-y-3 text-sm text-white/75">
                <li className="flex gap-3"><span className="text-cyan-300">01</span><span>Choose a social platform and authorize your account.</span></li>
                <li className="flex gap-3"><span className="text-cyan-300">02</span><span>Review your connected channels and creator details.</span></li>
                <li className="flex gap-3"><span className="text-cyan-300">03</span><span>Use Yepper to manage your creator presence and discover ad opportunities.</span></li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => { setOpen(false); router.push('/?panel=youtube'); }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90"
            >
              Continue to Social Media <ArrowRightIcon className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-[11px] text-white/40">You’ll review and connect accounts on the next screen. YouTube and TikTok are currently supported.</p>
          </section>
        </div>
      )}
    </>
  );
}
