import { useEffect, useState } from 'react';
import axios from 'axios';

export type ApiHealthStatus = 'live' | 'offline' | 'unknown';

/**
 * Probes the backend API /health endpoint to reflect true connectivity state in the header badge.
 */
export function useApiHealth(): { status: ApiHealthStatus } {
  const [status, setStatus] = useState<ApiHealthStatus>('unknown');

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        const response = await axios.get('/health', { timeout: 2500 });
        if (isMounted) {
          const apiStatus = response.data?.status;
          if (response.status === 200 && (apiStatus === 'healthy' || apiStatus === 'degraded' || apiStatus === 'ok')) {
            setStatus('live');
          } else {
            setStatus('offline');
          }
        }
      } catch (err) {
        if (isMounted) {
          setStatus('offline');
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { status };
}
