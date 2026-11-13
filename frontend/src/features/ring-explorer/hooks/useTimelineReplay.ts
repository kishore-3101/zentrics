import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineEvent, TimelineRunningTotals } from '../../../types/ring-graph';

interface UseTimelineReplayProps {
  timeline: TimelineEvent[];
  durationMinutes: number;
}

export function useTimelineReplay({ timeline, durationMinutes }: UseTimelineReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const [progress, setProgress] = useState(0); // 0.0 to 1.0

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Derive duration in virtual seconds
  const totalVirtualSeconds = Math.max(durationMinutes * 60, 60);

  // Play / Pause / Restart / Scrub actions
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const restart = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
  }, []);
  const scrubTo = useCallback((newProgress: number) => {
    setProgress(Math.min(1, Math.max(0, newProgress)));
  }, []);

  // Animation frame loop for playback
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = (now: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSeconds = (now - lastTimeRef.current) / 1000;
        // virtual time step (speed 1x = 1 virtual min per 2 real seconds for presentation fluidity)
        const presentationTimeScale = (totalVirtualSeconds / 25) * speed;
        const progressIncrement = (deltaSeconds * presentationTimeScale) / totalVirtualSeconds;

        setProgress((prev) => {
          const next = prev + progressIncrement;
          if (next >= 1.0) {
            setIsPlaying(false);
            return 1.0;
          }
          return next;
        });
      }

      lastTimeRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, speed, totalVirtualSeconds]);

  // Derive active transactions and running totals up to current progress
  const { completedEvents, activeTxnIds, runningTotals } = useMemo(() => {
    const completed: TimelineEvent[] = [];
    const activeIds = new Set<string>();

    let inflow = 0;
    let cashedOut = 0;

    timeline.forEach((evt) => {
      if (evt.progress <= progress || progress >= 0.99) {
        completed.push(evt);
        activeIds.add(evt.txn_id);

        if (evt.channel === 'ATM_WITHDRAWAL') {
          cashedOut += evt.amount;
        } else if (evt.hop_index === 1) {
          inflow += evt.amount;
        }
      }
    });

    const atRisk = Math.max(0, inflow - cashedOut);

    const totals: TimelineRunningTotals = {
      inflow,
      cashed_out: cashedOut,
      at_risk: atRisk,
      completed_txns: completed.length,
    };

    return { completedEvents: completed, activeTxnIds: activeIds, runningTotals: totals };
  }, [timeline, progress]);

  // Format current virtual elapsed time
  const currentElapsedSeconds = Math.round(progress * totalVirtualSeconds);
  const minutes = Math.floor(currentElapsedSeconds / 60);
  const seconds = currentElapsedSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedTime = `T+${pad(minutes)}:${pad(seconds)}m`;

  return {
    isPlaying,
    speed,
    setSpeed,
    progress,
    play,
    pause,
    restart,
    scrubTo,
    formattedTime,
    runningTotals,
    activeTxnIds,
    completedEvents,
  };
}
