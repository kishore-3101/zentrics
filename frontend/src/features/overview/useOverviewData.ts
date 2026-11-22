import { useCallback, useEffect, useState } from 'react';
import { fetchOverview } from '../../services/overview.service';
import type { OverviewData } from './types';

type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: OverviewData };

export function useOverviewData() {
  const [state, setState] = useState<OverviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchOverview()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load overview data.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { state, reload };
}
