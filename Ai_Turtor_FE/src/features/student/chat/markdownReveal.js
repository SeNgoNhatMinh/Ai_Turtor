import { extractUnderstandingCheck } from './understandingCheck.js';

export const REVEAL_MIN_CHARS = 32;

export function revealSourceMarkdown(markdown) {
  const text = String(markdown || '');
  const extracted = extractUnderstandingCheck(text);
  return extracted.quiz ? String(extracted.before || '') : text;
}

export function shouldRevealAnswer({ enabled = false, markdown = '', reducedMotion = false } = {}) {
  if (!enabled || reducedMotion) return false;
  return revealSourceMarkdown(markdown).trim().length >= REVEAL_MIN_CHARS;
}

export function revealStepSize(length) {
  const size = Number(length) || 0;
  if (size <= 0) return 1;
  const frames = Math.min(120, Math.max(28, Math.round(size / 16)));
  return Math.max(6, Math.ceil(size / frames));
}

export function nextRevealIndex(full, current, step) {
  const text = String(full || '');
  const from = Math.max(0, Number(current) || 0);
  if (from >= text.length) return text.length;
  const stride = Math.max(1, Number(step) || 1);
  let target = Math.min(text.length, from + stride);
  if (target >= text.length) return text.length;
  while (target < text.length && !/\s/.test(text[target])) {
    target += 1;
    if (target - (from + stride) > 18) break;
  }
  if (target < text.length && /\s/.test(text[target])) target += 1;
  return target;
}
