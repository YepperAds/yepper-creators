'use client';

import { useEffect, useRef, useState } from 'react';

// Fades + rises children in the first time they scroll into view — see
// .yp-reveal/.yp-revealed in globals.css. Plain IntersectionObserver, no
// animation library, so it degrades to just "visible" if JS is slow to hydrate.
export default function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`yp-reveal ${visible ? 'yp-revealed' : ''} ${className}`}>
      {children}
    </div>
  );
}
