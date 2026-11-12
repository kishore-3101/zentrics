import { gsap } from 'gsap';

const CLEAR = 'transform,opacity,visibility';

/**
 * Subtle entrance for the application shell.
 * Targets elements by `data-anim` inside `scope`. Returns a cleanup function.
 * Only transform/opacity are animated, and inline styles are cleared afterwards.
 */
export function playShellEntrance(scope: HTMLElement, reducedMotion: boolean): () => void {
  if (reducedMotion) return () => undefined;

  const ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    const sidebar = scope.querySelector('[data-anim="sidebar"]');
    const header = scope.querySelector('[data-anim="header"]');
    const content = scope.querySelector('[data-anim="content"]');
    const navItems = scope.querySelectorAll('[data-anim="nav-item"]');

    if (sidebar) tl.from(sidebar, { x: -24, opacity: 0, duration: 0.6, clearProps: CLEAR }, 0);
    if (header) tl.from(header, { y: -18, opacity: 0, duration: 0.55, clearProps: CLEAR }, 0.08);
    if (navItems.length) {
      tl.from(navItems, { x: -10, opacity: 0, duration: 0.45, stagger: 0.05, clearProps: CLEAR }, 0.25);
    }
    if (content) tl.from(content, { y: 14, opacity: 0, duration: 0.6, clearProps: CLEAR }, 0.18);
  }, scope);

  return () => ctx.revert();
}
