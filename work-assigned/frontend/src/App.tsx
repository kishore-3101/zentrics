import { MotionConfig } from 'motion/react';
import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Landing from './pages/Landing';

const Overview = lazy(() => import('./pages/Overview'));
const AlertQueue = lazy(() => import('./pages/AlertQueue'));
const RingExplorer = lazy(() => import('./pages/RingExplorer'));
const Metrics = lazy(() => import('./pages/Metrics'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    // reducedMotion="user" makes every Motion animation respect prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppLayout />}>
            <Route path="/overview" element={<Overview />} />
            <Route path="/alerts" element={<AlertQueue />} />
            <Route path="/rings/:id" element={<RingExplorer />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
