import axios from 'axios';
import { USE_MOCK } from '../config/env';
import { MOCK_OVERVIEW } from '../features/overview/data/mockOverview';
import type { OverviewData } from '../features/overview/types';

/**
 * Overview data source.
 * Conforms to GET /overview on the mock/backend server.
 */
export async function fetchOverview(): Promise<OverviewData> {
  if (USE_MOCK) {
    return MOCK_OVERVIEW;
  }
  const response = await axios.get<OverviewData>('/overview');
  return response.data;
}
