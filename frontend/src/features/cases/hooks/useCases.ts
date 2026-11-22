import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllCases, reassignCase } from '../../../services/cases.service';
import { postCaseAction, type CaseActionPayload } from '../../../services/alerts.service';
import type { CaseFilterState, CaseRecord } from '../../../types/cases';

const INITIAL_FILTERS: CaseFilterState = {
  searchQuery: '',
  statuses: [],
  assignee: 'all',
};

export function useCases() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CaseFilterState>(INITIAL_FILTERS);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [reassignModalCase, setReassignModalCase] = useState<CaseRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllCases();
      setCases(data);

      // Keep selectedCase synchronized with updated case data if open
      setSelectedCase((prev) => {
        if (!prev) return null;
        return data.find((c) => c.case_id === prev.case_id) || null;
      });
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }, []);

  const isFiltered = useMemo(() => {
    return (
      filters.searchQuery.trim().length > 0 ||
      filters.statuses.length > 0 ||
      filters.assignee !== 'all'
    );
  }, [filters]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // 1. Text Search Filter
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesCaseId = c.case_id.toString().includes(query);
        const matchesRingId = c.ring_id.toLowerCase().includes(query);
        const matchesAssignee = (c.assigned_to || '').toLowerCase().includes(query);
        const matchesNotes = (c.notes || '').toLowerCase().includes(query);
        const matchesTypology = c.ring_type.toLowerCase().includes(query);

        if (!matchesCaseId && !matchesRingId && !matchesAssignee && !matchesNotes && !matchesTypology) {
          return false;
        }
      }

      // 2. Status Filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) {
        return false;
      }

      // 3. Assignee Filter
      if (filters.assignee !== 'all') {
        if (filters.assignee === 'unassigned') {
          if (c.assigned_to !== null && c.assigned_to.trim() !== '') {
            return false;
          }
        } else {
          if (!c.assigned_to || !c.assigned_to.toLowerCase().includes(filters.assignee.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }, [cases, filters]);

  const performAction = useCallback(
    async (caseRecord: CaseRecord, payload: CaseActionPayload) => {
      try {
        setIsSubmitting(true);
        await postCaseAction(caseRecord.ring_id, caseRecord.case_id, payload);
        await loadCases();
      } catch (err) {
        console.error('Failed to perform case action:', err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadCases],
  );

  const reassignCaseAction = useCallback(
    async (caseRecord: CaseRecord, newAssignee: string) => {
      try {
        setIsSubmitting(true);
        await reassignCase(caseRecord.case_id, caseRecord.ring_id, newAssignee);
        await loadCases();
      } catch (err) {
        console.error('Failed to reassign case:', err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadCases],
  );

  const openReassign = useCallback((caseRecord: CaseRecord) => {
    setReassignModalCase(caseRecord);
  }, []);

  const closeReassign = useCallback(() => {
    setReassignModalCase(null);
  }, []);

  return {
    cases,
    filteredCases,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    isFiltered,
    selectedCase,
    setSelectedCase,
    page,
    setPage,
    pageSize,
    setPageSize,
    reassignModalCase,
    openReassign,
    closeReassign,
    performAction,
    reassignCaseAction,
    isSubmitting,
    refreshCases: loadCases,
  };
}
