import { USE_MOCK } from '../config/env';

export type ApiHealthStatus = 'live' | 'mock' | 'offline' | 'unknown';

/**
 * Shell-level placeholder. It reports what we actually know (mock vs. not),
 * and never claims a live connection.
 * TODO: replace with a real probe once a health route exists in the API contract.
 */
export function useApiHealth(): { status: ApiHealthStatus } {
  return { status: USE_MOCK ? 'mock' : 'unknown' };
}
