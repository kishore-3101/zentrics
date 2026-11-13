import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAlerts, postCaseAction, type CaseActionPayload } from '../../../services/alerts.service';
import type {
  AlertFilterState,
  AlertRecord,
  AlertSortField,
  AlertSortState,
} from '../../../types/alerts';

const DEFAULT_FILTERS: AlertFilterState = {
  searchQuery: '',
  typologies: [],
  statuses: [],
  minRiskScore: 0,
  amountPreset: 'all',
  datePreset: 'all',
};

const DEFAULT_SORT: AlertSortState = {
  field: 'priority',
  direction: 'desc',
};

export function useAlertQueue() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AlertFilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<AlertSortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedAlert, setSelectedAlert] = useState<AlertRecord | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [newAlertIds] = useState<Set<string>>(() => new Set());

  // Load initial alerts
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAlerts();
      setAlerts(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load alert queue data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Handle column sort toggle
  const handleSortChange = useCallback((field: AlertSortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'desc' ? 'asc' : 'desc',
        };
      }
      return { field, direction: 'desc' };
    });
    setPage(1);
  }, []);

  // Reset all filters to default
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const isFiltered = useMemo(() => {
    return (
      filters.searchQuery.trim() !== '' ||
      filters.typologies.length > 0 ||
      filters.statuses.length > 0 ||
      filters.minRiskScore > 0 ||
      filters.amountPreset !== 'all' ||
      filters.datePreset !== 'all'
    );
  }, [filters]);

  // Filter and sort alerts
  const filteredAndSortedAlerts = useMemo(() => {
    let result = [...alerts];

    // 1. Text Search Query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.ring_id.toLowerCase().includes(query) ||
          (a.assigned_to && a.assigned_to.toLowerCase().includes(query)) ||
          (a.case_notes && a.case_notes.toLowerCase().includes(query)) ||
          a.fingerprint.toLowerCase().includes(query) ||
          a.pattern_tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    // 2. Typology Filter
    if (filters.typologies.length > 0) {
      result = result.filter((a) => filters.typologies.includes(a.ring_type));
    }

    // 3. Status Filter
    if (filters.statuses.length > 0) {
      result = result.filter((a) => filters.statuses.includes(a.status));
    }

    // 4. Min Risk Score
    if (filters.minRiskScore > 0) {
      result = result.filter((a) => a.score >= filters.minRiskScore);
    }

    // 5. Amount Preset
    if (filters.amountPreset !== 'all') {
      const threshold =
        filters.amountPreset === 'above_500k'
          ? 500_000
          : filters.amountPreset === 'above_1m'
            ? 1_000_000
            : 2_000_000;
      result = result.filter((a) => a.amount_at_risk >= threshold);
    }

    // 6. Date Preset
    if (filters.datePreset !== 'all') {
      const now = Date.now();
      const cutoff =
        filters.datePreset === 'today'
          ? now - 24 * 3_600_000
          : now - 7 * 86_400_000;
      result = result.filter((a) => new Date(a.detected_at).getTime() >= cutoff);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'amount_at_risk':
          comparison = a.amount_at_risk - b.amount_at_risk;
          break;
        case 'amount_moved':
          comparison = a.amount_moved - b.amount_moved;
          break;
        case 'detected_at':
          comparison =
            new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime();
          break;
        default:
          comparison = a.priority - b.priority;
      }
      return sort.direction === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [alerts, filters, sort]);

  // Execute case action (Investigate, Escalate, Freeze, False Positive, Note)
  const handlePerformAction = useCallback(
    async (payload: CaseActionPayload) => {
      if (!selectedAlert) return;
      setIsSubmittingAction(true);

      try {
        const result = await postCaseAction(
          selectedAlert.ring_id,
          selectedAlert.case_id,
          payload,
        );

        if (result.success) {
          // Update in local state
          setAlerts((prev) =>
            prev.map((item) =>
              item.ring_id === result.alert.ring_id ? result.alert : item,
            ),
          );
          setSelectedAlert(result.alert);
        }
      } catch (err) {
        console.error('Case action error:', err);
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [selectedAlert],
  );

  return {
    alerts,
    filteredAlerts: filteredAndSortedAlerts,
    loading,
    error,
    filters,
    setFilters,
    isFiltered,
    sort,
    handleSortChange,
    handleResetFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    selectedAlert,
    setSelectedAlert,
    handlePerformAction,
    isSubmittingAction,
    newAlertIds,
    reload: loadAlerts,
  };
}
