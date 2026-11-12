import { USE_MOCK } from '../config/env';
import { MOCK_OVERVIEW } from '../features/overview/data/mockOverview';
import type { OverviewData } from '../features/overview/types';

/**
 * Overview data source.
 * Today this only serves clearly labelled mock data. When the API contract is
 * available, call it here with the shared Axios client and map the response
 * into `OverviewData`; the dashboard itself will not need to change.
 */
export async function fetchOverview(): Promise<OverviewData> {
  if (!USE_MOCK) {
    throw new Error('The live overview API is not wired yet. Set VITE_USE_MOCK=true to use mock data.');
  }
  return MOCK_OVERVIEW;
}
