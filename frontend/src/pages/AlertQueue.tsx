import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AlertDetailsDrawer } from '../features/alerts/components/AlertDetailsDrawer';
import { AlertFiltersBar } from '../features/alerts/components/AlertFiltersBar';
import { AlertKpiCards } from '../features/alerts/components/AlertKpiCards';
import { AlertQueueTable } from '../features/alerts/components/AlertQueueTable';
import { AlertTableSkeleton } from '../features/alerts/components/AlertTableSkeleton';
import { useAlertQueue } from '../features/alerts/hooks/useAlertQueue';

export default function AlertQueue() {
  const {
    alerts,
    filteredAlerts,
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
    reload,
  } = useAlertQueue();

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Alert Queue
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            High-density operational triage consuming <code className="font-mono text-gold-light text-xs bg-canvas/70 px-1.5 py-0.5 rounded border border-gold/15">v_alerts</code>. Click any row to inspect ring topology, view evidence, and execute enforcement actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gold/20 bg-card/60 px-3 py-2 text-xs font-semibold text-muted hover:text-ink hover:border-gold/40 transition-colors"
            title="Reload alert queue"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-semibold hover:bg-danger/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Four Topline KPI Cards */}
      <AlertKpiCards alerts={alerts} />

      {/* 2. Combined Filters & Search Toolbar */}
      <AlertFiltersBar
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        isFiltered={isFiltered}
        totalCount={alerts.length}
        filteredCount={filteredAlerts.length}
      />

      {/* 3. Main Alert Triage Table / Skeleton */}
      {loading ? (
        <AlertTableSkeleton />
      ) : (
        <AlertQueueTable
          alerts={filteredAlerts}
          selectedAlert={selectedAlert}
          onSelectAlert={(alert) => setSelectedAlert(alert)}
          sort={sort}
          onSortChange={handleSortChange}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          totalFiltered={filteredAlerts.length}
          onResetFilters={handleResetFilters}
          newAlertIds={newAlertIds}
        />
      )}

      {/* 4. Right-side Alert Details Drawer */}
      <AlertDetailsDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onPerformAction={handlePerformAction}
        isSubmitting={isSubmittingAction}
      />
    </div>
  );
}
