'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, DollarSign, Link2Icon, XIcon } from 'lucide-react';

const SOCIALS = [
  { name: 'YouTube', src: '/socials-icon/youtube-icon.png' },
  { name: 'Instagram', src: '/socials-icon/instagram-icon.png' },
  { name: 'TikTok', src: '/socials-icon/tiktok-icon.png' },
  { name: 'Facebook', src: '/socials-icon/facebook-icon.png' },
];

const SOCIAL_POSITIONS = [
  { className: 'left-5 top-2', x: 72, y: 42 },
  { className: 'right-5 top-2', x: -72, y: 42 },
  { className: 'right-5 bottom-2', x: -72, y: -42 },
  { className: 'left-5 bottom-2', x: 72, y: -42 },
];

function positionsForSocial(index: number) {
  return SOCIAL_POSITIONS[index];
}

export default function SocialConnectLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeSocial, setActiveSocial] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'connect' | 'ready' | 'send' | 'payout' | 'earned'>('connect');

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
      setAnimationPhase('connect');
      return;
    }

    let step = 0;
    setAnimationPhase('connect');
    const begin = window.setTimeout(() => setActiveSocial(0), 350);
    const cycle = window.setInterval(() => {
      step += 1;
      if (step < SOCIALS.length) {
        setAnimationPhase('connect');
        setActiveSocial(step);
      } else if (step === SOCIALS.length || step === SOCIALS.length + 1) {
        setAnimationPhase('ready');
        setActiveSocial(null);
      } else if (step === SOCIALS.length + 2) {
        setAnimationPhase('send');
        setActiveSocial(null);
      } else if (step === SOCIALS.length + 3) {
        setAnimationPhase('payout');
        setActiveSocial(null);
      } else if (step === SOCIALS.length + 4) {
        setAnimationPhase('earned');
        setActiveSocial(null);
      } else {
        step = 0;
        setAnimationPhase('connect');
        setActiveSocial(0);
      }
    }, 1000);

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
        className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-[#171717]/95 py-2 pl-3 pr-3.5 text-xs font-semibold text-white shadow-xl shadow-black/40 backdrop-blur transition hover:border-white/20 hover:bg-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:gap-3 sm:py-2.5 sm:pl-4 sm:pr-5"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Connect socials"
      >
        <Link2Icon className="h-4 w-4 shrink-0 text-white/80" aria-hidden="true" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 ease-out group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:max-w-28 group-focus-visible:opacity-100">Connect socials</span>
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
              </div>
              {SOCIALS.map((social, index) => {
                const position = positionsForSocial(index);
                const isConnecting = animationPhase === 'connect' && activeSocial === index;
                const isSending = animationPhase === 'send' || animationPhase === 'payout';
                const isConnected = animationPhase !== 'connect' || (activeSocial !== null && index < activeSocial);
                return (
                  <motion.span
                    key={social.name}
                    initial={false}
                    animate={{
                      x: isConnecting ? position.x : 0,
                      y: isConnecting ? position.y : 0,
                      scale: isConnecting ? 0.35 : isSending ? 1.12 : 1,
                      opacity: isConnecting ? 0 : 1,
                      zIndex: isConnecting || isSending ? 30 : 10,
                    }}
                    transition={{
                      x: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      y: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      scale: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.4, delay: isConnecting ? 0.15 : 0 },
                    }}
                    className={`absolute ${position.className} flex h-10 w-10 items-center justify-center overflow-visible rounded-full border border-white/10 bg-white shadow-lg shadow-black/30 ${isSending ? 'ring-2 ring-coral/70 ring-offset-2 ring-offset-[#111]' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={social.src} alt={social.name} className="h-full w-full rounded-full object-cover" />
                    {isConnected && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#111] bg-emerald-400 text-[#062b1a]"
                      ><CheckIcon className="h-2.5 w-2.5" strokeWidth={3} /></motion.span>
                    )}
                    {animationPhase === 'earned' && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#111] bg-emerald-400 text-[#062b1a] shadow-md shadow-emerald-500/30"
                      ><DollarSign className="h-2.5 w-2.5" strokeWidth={3} /></motion.span>
                    )}
                  </motion.span>
                );
              })}

              <AnimatePresence>
                {(animationPhase === 'send' || animationPhase === 'payout') && SOCIALS.map((social, index) => {
                  const destination = positionsForSocial(index);
                  const sendingMoney = animationPhase === 'payout';
                  return (
                    <motion.span
                      key={`${sendingMoney ? 'money' : 'ad'}-${social.name}`}
                      initial={{ x: 0, y: 0, scale: 0.6, opacity: 0 }}
                      animate={{
                        x: [0, 0, -destination.x, -destination.x],
                        y: [0, 0, -destination.y, -destination.y],
                        scale: [0.7, 1, 1, 0.85],
                        opacity: [0, 1, 1, 0],
                      }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.85, delay: index * 0.03, ease: [0.22, 1, 0.36, 1], times: [0, 0.12, 0.82, 1] }}
                      style={{ marginLeft: -20, marginTop: -14 }}
                      className={`absolute left-1/2 top-1/2 z-30 flex h-7 min-w-7 items-center justify-center rounded-md border px-1 text-[10px] font-black tracking-wider text-white shadow-lg ${sendingMoney ? 'border-emerald-300/80 bg-emerald-500 text-[#062b1a] shadow-emerald-400/55' : 'w-10 border-coral/70 bg-[#351a17] shadow-[0_0_18px_rgba(232,71,43,0.55)]'}`}
                    >{sendingMoney ? '$' : 'AD'}</motion.span>
                  );
                })}
              </AnimatePresence>
              <AnimatePresence>
                {animationPhase === 'earned' && (
                  <motion.span
                    key="earned-dollar"
                    initial={{ scale: 0, opacity: 0, y: 6 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.6, opacity: 0, y: -5 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="absolute left-1/2 top-1/2 z-40 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#111] bg-emerald-400 text-[#062b1a] shadow-lg shadow-emerald-500/35"
                  ><DollarSign className="h-5 w-5" strokeWidth={3} /></motion.span>
                )}
              </AnimatePresence>
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
