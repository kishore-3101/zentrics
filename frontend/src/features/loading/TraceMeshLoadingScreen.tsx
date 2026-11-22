import { gsap } from 'gsap';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  CinematicBrandHeader,
  CinematicLoadingBar,
} from './components/CinematicLoadingBar';
import { Globe3DBackground } from './components/Globe3DBackground';
import { HudCornerOverlays } from './components/HudCornerOverlays';
import { TransactionNetworkFlow } from './components/TransactionNetworkFlow';

interface MuleNetLoadingScreenProps {
  onComplete?: () => void;
  minDurationMs?: number; // Default: ~3600ms
  autoComplete?: boolean; // Default: true
}

export function MuleNetLoadingScreen({
  onComplete,
  minDurationMs = 3600,
  autoComplete = true,
}: MuleNetLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const handleFinish = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete?.();
    }, 600); // 600ms exit fade
  }, [onComplete]);

  // Orchestrate the Cinematic GSAP Sequence
  useEffect(() => {
    // If reduced motion is preferred, advance quickly with minimal transitions
    const duration = reducedMotion ? 1.2 : minDurationMs / 1000;

    const progressObj = { value: 0 };

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          if (autoComplete) {
            handleFinish();
          }
        },
      });

      // Smooth multi-stage loading progress curve
      tl.to(progressObj, {
        value: 100,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          setProgress(progressObj.value);
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [minDurationMs, autoComplete, handleFinish, reducedMotion]);

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 0.6 } }}
          className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#030A06] select-none"
        >
          {/* Layer 1: 3D Animated Globe Background */}
          <Globe3DBackground />

          {/* Layer 2: Corner Tactical HUD Overlays */}
          <HudCornerOverlays />

          {/* Layer 3: Top MULE-NET Brand Pill Header */}
          <div className="relative z-30 pt-4">
            <CinematicBrandHeader />
          </div>

          {/* Layer 4: Main Financial Transaction Network Flow */}
          <div className="relative z-20 flex-1 flex items-center justify-center min-h-0">
            <TransactionNetworkFlow reducedMotion={reducedMotion} />
          </div>

          {/* Layer 5: Sleek Glowing Loading Bar (Bottom) */}
          <div className="relative z-30 pb-6 flex justify-center">
            <CinematicLoadingBar
              progress={progress}
              onSkip={handleFinish}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Backwards-compatibility alias
export const TraceMeshLoadingScreen = MuleNetLoadingScreen;
