import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface AnimatedNumberProps {
  value: number;
  /** Must be referentially stable (module-level or memoized), or the tween restarts every render. */
  format: (value: number) => string;
  duration?: number;
  /** Seconds before the count-up starts. */
  delay?: number;
  className?: string;
}

/**
 * GSAP count-up. Text is written straight to the DOM node (no React re-render per frame).
 * When `value` changes later (e.g. live updates), it counts from the currently shown number.
 * Reduced motion shows the final value immediately.
 */
export function AnimatedNumber({ value, format, duration = 1.4, delay = 0, className }: AnimatedNumberProps) {
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(reducedMotion ? value : 0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reducedMotion) {
      shown.current = value;
      node.textContent = format(value);
      return;
    }

    const state = { current: shown.current };
    const tween = gsap.to(state, {
      current: value,
      duration,
      delay,
      ease: 'power3.out',
      onUpdate: () => {
        shown.current = state.current;
        node.textContent = format(state.current);
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, format, duration, delay, reducedMotion]);

  return (
    <>
      <span ref={ref} aria-hidden className={className}>
        {format(reducedMotion ? value : 0)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
