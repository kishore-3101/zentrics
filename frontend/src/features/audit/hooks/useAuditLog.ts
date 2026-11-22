import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllAuditLogs } from '../../../services/cases.service';
import type { AuditFilterState, AuditLogEntry } from '../../../types/cases';

const INITIAL_AUDIT_FILTERS: AuditFilterState = {
  searchQuery: '',
  actions: [],
  actor: 'all',
  datePreset: 'all',
};

export function useAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilterState>(INITIAL_AUDIT_FILTERS);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_AUDIT_FILTERS);
    setPage(1);
  }, []);

  const isFiltered = useMemo(() => {
    return (
      filters.searchQuery.trim().length > 0 ||
      filters.actions.length > 0 ||
      filters.actor !== 'all' ||
      filters.datePreset !== 'all'
    );
  }, [filters]);

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    return logs.filter((entry) => {
      // 1. Text Search
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesActionId = entry.action_id.toString().includes(query);
        const matchesCaseId = entry.case_id.toString().includes(query);
        const matchesRingId = entry.ring_id.toLowerCase().includes(query);
        const matchesActor = entry.actor.toLowerCase().includes(query);
        const matchesNote = (entry.note || '').toLowerCase().includes(query);
        const matchesAction = entry.action.toLowerCase().includes(query);

        if (
          !matchesActionId &&
          !matchesCaseId &&
          !matchesRingId &&
          !matchesActor &&
          !matchesNote &&
          !matchesAction
        ) {
          return false;
        }
      }

      // 2. Action Types Filter
      if (filters.actions.length > 0 && !filters.actions.includes(entry.action)) {
        return false;
      }

      // 3. Actor Filter
      if (filters.actor !== 'all') {
        if (!entry.actor.toLowerCase().includes(filters.actor.toLowerCase())) {
          return false;
        }
      }

      // 4. Date Preset Filter
      if (filters.datePreset !== 'all') {
        const entryTs = new Date(entry.ts).getTime();
        if (filters.datePreset === 'today' && now - entryTs > oneDayMs) {
          return false;
        }
        if (filters.datePreset === 'last_7_days' && now - entryTs > sevenDaysMs) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filters]);

  return {
    logs,
    filteredLogs,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    isFiltered,
    selectedEntry,
    setSelectedEntry,
    page,
    setPage,
    pageSize,
    setPageSize,
    refreshAuditLogs: loadAuditLogs,
  };
}
