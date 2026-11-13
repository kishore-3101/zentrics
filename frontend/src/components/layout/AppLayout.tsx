import { motion } from 'motion/react';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { playShellEntrance } from '../../animations/gsapAnimations';
import { SimulationProvider } from '../../features/simulation/SimulationProvider';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { EASE_OUT } from '../../lib/motion';
import { getRouteMeta } from '../../lib/navigation';
import { RouteFallback } from '../ui/RouteFallback';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Header } from './Header';
import { MobileDrawer, Sidebar } from './Sidebar';

const COLLAPSE_STORAGE_KEY = 'tracemesh:sidebar-collapsed';

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const { pathname } = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reducedMotion = usePrefersReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerOpen = mobileOpen && !isDesktop;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable: keep in-memory state only */
      }
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => setMobileOpen(true), []);
  const closeDrawer = useCallback(() => setMobileOpen(false), []);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    return playShellEntrance(rootRef.current, reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    document.title = `${getRouteMeta(pathname).title} · TraceMesh`;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <SimulationProvider>
      <div ref={rootRef} className="relative isolate flex h-dvh overflow-hidden bg-canvas">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-aurora absolute inset-0" />
          <div className="bg-grid-fine absolute inset-0" />
        </div>

        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-card px-4 py-2 text-sm text-gold-light focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>

        {isDesktop && <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />}
        <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

        <div ref={scrollRef} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Header onOpenNavigation={openDrawer} />
          <main id="main-content" data-anim="content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <ErrorBoundary fallbackTitle="View Failed to Render">
                <Suspense fallback={<RouteFallback />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </main>
        </div>
      </div>
    </SimulationProvider>
  );
}
