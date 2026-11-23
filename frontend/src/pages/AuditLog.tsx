import {
  Briefcase,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { ExportAuditButton } from '../features/audit/components/ExportAuditButton';
import { AuditDetailModal } from '../features/audit/components/AuditDetailModal';
import { AuditFiltersBar } from '../features/audit/components/AuditFiltersBar';
import { AuditLogTable } from '../features/audit/components/AuditLogTable';
import { useAuditLog } from '../features/audit/hooks/useAuditLog';
import { CaseDetailsDrawer } from '../features/cases/components/CaseDetailsDrawer';
import { CaseFiltersBar } from '../features/cases/components/CaseFiltersBar';
import { CaseKpiCards } from '../features/cases/components/CaseKpiCards';
import { CaseTable } from '../features/cases/components/CaseTable';
import { ReassignAnalystModal } from '../features/cases/components/ReassignAnalystModal';
import { useCases } from '../features/cases/hooks/useCases';

export default function AuditLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'audit' ? 'audit' : 'cases';
  const [activeTab, setActiveTab] = useState<'cases' | 'audit'>(initialTab);

  // Hook 1: Cases State
  const {
    cases,
    filteredCases,
    loading: casesLoading,
    filters: caseFilters,
    setFilters: setCaseFilters,
    resetFilters: resetCaseFilters,
    isFiltered: isCaseFiltered,
    selectedCase,
    setSelectedCase,
    page: casePage,
    setPage: setCasePage,
    pageSize: casePageSize,
    setPageSize: setCasePageSize,
    reassignModalCase,
    openReassign,
    closeReassign,
    performAction,
    reassignCaseAction,
    isSubmitting,
    refreshCases,
  } = useCases();

  // Hook 2: Compliance Audit Log State
  const {
    logs,
    filteredLogs,
    loading: auditLoading,
    filters: auditFilters,
    setFilters: setAuditFilters,
    resetFilters: resetAuditFilters,
    isFiltered: isAuditFiltered,
    selectedEntry,
    setSelectedEntry,
    page: auditPage,
    setPage: setAuditPage,
    pageSize: auditPageSize,
    setPageSize: setAuditPageSize,
    refreshAuditLogs,
  } = useAuditLog();

  const handleTabChange = (tab: 'cases' | 'audit') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleGlobalRefresh = async () => {
    await Promise.all([refreshCases(), refreshAuditLogs()]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Case Management &amp; Compliance Audit
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Operational case triage tracker and immutable regulatory audit trail conforming to PMLA statutory retention.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'audit' && (
            <ExportAuditButton entries={filteredLogs} />
          )}

          <button
            type="button"
            onClick={handleGlobalRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gold/25 bg-card/60 px-3 py-2 text-xs font-medium text-ink hover:bg-white/5 transition-colors"
            title="Refresh case status and audit trail"
          >
            <RefreshCw className="size-3.5 text-gold-light" />
            Refresh
          </button>
        </div>
      </div>

      {/* Dual Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gold/15 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('cases')}
          className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === 'cases'
              ? 'border border-gold/35 bg-gold/15 text-gold-light shadow-xs'
              : 'text-muted hover:text-ink hover:bg-white/4'
          }`}
        >
          <Briefcase className="size-4" />
          <span>Case Management Tracker</span>
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px] text-ink">
            {cases.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('audit')}
          className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === 'audit'
              ? 'border border-gold/35 bg-gold/15 text-gold-light shadow-xs'
              : 'text-muted hover:text-ink hover:bg-white/4'
          }`}
        >
          <ScrollText className="size-4" />
          <span>Compliance Audit Trail</span>
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px] text-ink">
            {logs.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Case Management */}
      {activeTab === 'cases' && (
        <div className="space-y-6">
          {casesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : (
            <CaseKpiCards cases={cases} />
          )}

          <CaseFiltersBar
            filters={caseFilters}
            onChange={setCaseFilters}
            onReset={resetCaseFilters}
            isFiltered={isCaseFiltered}
            totalCount={cases.length}
            filteredCount={filteredCases.length}
          />

          {casesLoading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <CaseTable
              cases={filteredCases}
              selectedCase={selectedCase}
              onSelectCase={setSelectedCase}
              onOpenReassign={openReassign}
              page={casePage}
              pageSize={casePageSize}
              onPageChange={setCasePage}
              onPageSizeChange={setCasePageSize}
              totalFiltered={filteredCases.length}
              onResetFilters={resetCaseFilters}
            />
          )}
        </div>
      )}

      {/* Tab 2: Compliance Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <AuditFiltersBar
            filters={auditFilters}
            onChange={setAuditFilters}
            onReset={resetAuditFilters}
            isFiltered={isAuditFiltered}
            totalCount={logs.length}
            filteredCount={filteredLogs.length}
          />

          {auditLoading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <AuditLogTable
              logs={filteredLogs}
              onSelectEntry={setSelectedEntry}
              page={auditPage}
              pageSize={auditPageSize}
              onPageChange={setAuditPage}
              onPageSizeChange={setAuditPageSize}
              totalFiltered={filteredLogs.length}
              onResetFilters={resetAuditFilters}
            />
          )}
        </div>
      )}

      {/* Case Details Drawer (Dossier) */}
      <CaseDetailsDrawer
        caseRecord={selectedCase}
        isOpen={Boolean(selectedCase)}
        onClose={() => setSelectedCase(null)}
        onPerformAction={async (c, payload) => {
          await performAction(c, payload);
          await refreshAuditLogs();
        }}
        onOpenReassign={openReassign}
        isSubmitting={isSubmitting}
      />

      {/* Reassign Modal */}
      {reassignModalCase && (
        <ReassignAnalystModal
          caseRecord={reassignModalCase}
          isOpen={Boolean(reassignModalCase)}
          onClose={closeReassign}
          onReassign={async (newAssignee) => {
            await reassignCaseAction(reassignModalCase, newAssignee);
            await refreshAuditLogs();
          }}
        />
      )}

      {/* Audit Detail Modal */}
      <AuditDetailModal
        entry={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
