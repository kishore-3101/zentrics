import { motion } from 'motion/react';
import { ArrowRight, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../components/brand/BrandLockup';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TraceMeshLoadingScreen } from '../features/loading/TraceMeshLoadingScreen';
import { EASE_OUT } from '../lib/motion';

const STORAGE_KEY = 'tracemesh_intro_played';

export default function Landing() {
  const [showIntro, setShowIntro] = useState(() => {
    // Only show automatically on first entry of session
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem(STORAGE_KEY);
    }
    return true;
  });

  useEffect(() => {
    document.title = 'TraceMesh · Financial Intelligence';
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
    sessionStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleReplayIntro = () => {
    setShowIntro(true);
  };

  return (
    <>
      {/* 1. Cinematic Financial Intelligence Loading Experience */}
      {showIntro && (
        <TraceMeshLoadingScreen onComplete={handleIntroComplete} />
      )}

      {/* 2. Existing Landing Page (100% Preserved) */}
      <div className="relative isolate min-h-dvh overflow-hidden bg-canvas">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-aurora absolute inset-0" />
          <div className="bg-grid-fine absolute inset-0" />
        </div>

        <header className="mx-auto flex h-20 max-w-6xl items-center px-6">
          <BrandLockup />
        </header>

        <main className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-4xl flex-col items-center justify-center px-6 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-2">
              <StatusBadge tone="gold" dot>
                Platform Ready
              </StatusBadge>
              <button
                type="button"
                onClick={handleReplayIntro}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-light hover:bg-gold/20 hover:border-gold/60 transition-colors cursor-pointer"
                title="Replay the cinematic 3D globe and transaction network intro"
              >
                <Play className="size-3 fill-current" />
                Replay Cinematic Intro
              </button>
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Detect mule account rings
              <span className="text-gold-gradient"> before the money disappears.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              TraceMesh groups suspicious account activity into actionable rings so investigators can see the network,
              understand the evidence and act.
            </p>
            <Link
              to="/overview"
              className="group mt-9 inline-flex h-12 items-center gap-2 rounded-xl border border-gold/40 bg-linear-to-r from-emerald/20 to-gold/20 px-6 text-sm font-semibold text-gold-light transition duration-200 hover:border-gold/70 hover:shadow-glow-gold"
            >
              Enter command center
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </motion.div>
        </main>
      </div>
    </>
  );
}
