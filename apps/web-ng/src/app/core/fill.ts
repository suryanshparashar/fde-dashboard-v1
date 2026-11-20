import { DestroyRef, signal, type Signal } from '@angular/core';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const prefersReducedMotion = reduced;

/** 0 → 1 over `dur` ms after `delay` ms, once (1 straight away with reduced motion). Fills, then the page is still. */
export function startFill(destroyRef: DestroyRef, delay: number, dur = 1300): Signal<number> {
  const e = signal(reduced() ? 1 : 0);
  if (reduced() || typeof requestAnimationFrame !== 'function') return e.asReadonly();
  let raf = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
    e.set(easeOut(t));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  destroyRef.onDestroy(() => cancelAnimationFrame(raf));
  return e.asReadonly();
}
