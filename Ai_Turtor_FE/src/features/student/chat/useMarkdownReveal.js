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
  const [revealState, setRevealState] = useState(() => ({ source, index: 0 }));
  const index = revealState.source === source ? revealState.index : 0;

  useEffect(() => {
    if (!animate) return undefined;

    let current = 0;
    let frame = 0;
    const step = revealStepSize(source.length);
    const tick = () => {
      current = nextRevealIndex(source, current, step);
      setRevealState({ source, index: current });
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
