import { useEffect, useState } from 'react';
import {
  nextRevealIndex,
  revealSourceMarkdown,
  revealStepSize,
  shouldRevealAnswer,
} from './markdownReveal';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function useMarkdownReveal(markdown, enabled = false) {
  const full = String(markdown || '');
  const source = revealSourceMarkdown(full);
  const reducedMotion = usePrefersReducedMotion();
  const animate = shouldRevealAnswer({ enabled, markdown: full, reducedMotion });
  const [index, setIndex] = useState(() => (animate ? 0 : source.length));

  useEffect(() => {
    if (!animate) {
      setIndex(source.length);
      return undefined;
    }

    setIndex(0);
    let current = 0;
    let frame = 0;
    const step = revealStepSize(source.length);
    const tick = () => {
      current = nextRevealIndex(source, current, step);
      setIndex(current);
      if (current < source.length) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [animate, source]);

  const done = !animate || index >= source.length;
  return {
    text: done ? full : source.slice(0, index),
    done,
  };
}
