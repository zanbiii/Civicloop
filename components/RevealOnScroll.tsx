'use client';

import { useEffect } from 'react';

const SELECTOR = '.reveal, .surface-card:not(.tilt)';
const SETTLE_MS = 900;

/**
 * One-shot entrance for sections below the fold: each `.reveal` / `.surface-card` rises in once
 * when it enters the viewport, then drops the helper classes so hover transforms work normally.
 * Anything already on screen when it mounts is left alone, so first paint is never delayed.
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          observer.unobserve(el);
          el.classList.add('is-revealed');
          window.setTimeout(() => el.classList.remove('reveal-pending', 'is-revealed'), SETTLE_MS);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );

    let frame = 0;
    const scan = () => {
      frame = 0;
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.parentElement?.closest('.reveal-pending')) return;
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        el.classList.add('reveal-pending');
        observer.observe(el);
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    };

    scan();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);

  return null;
}
