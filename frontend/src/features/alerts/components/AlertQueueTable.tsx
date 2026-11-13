import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
} from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { formatInrCompact, formatRelativeTime } from '../../../lib/formatters';
import type { AlertRecord, AlertSortField, AlertSortState } from '../../../types/alerts';
import { AlertRow } from './AlertRow';
import { AssigneeAvatar } from './AssigneeAvatar';

interface AlertQueueTableProps {
  alerts: AlertRecord[];
  selectedAlert: AlertRecord | null;
  onSelectAlert: (alert: AlertRecord) => void;
  sort: AlertSortState;
  onSortChange: (field: AlertSortField) => void;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  totalFiltered: number;
  onResetFilters: () => void;
  newAlertIds?: Set<string>;
}

export function AlertQueueTable({
  alerts,
  selectedAlert,
  onSelectAlert,
  sort,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalFiltered,
  onResetFilters,
  newAlertIds,
}: AlertQueueTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedAlerts = alerts.slice(startIndex, startIndex + pageSize);

  const renderSortIcon = (field: AlertSortField) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="size-3 text-muted/50 ml-1 inline" />;
    }
    return sort.direction === 'desc' ? (
      <ArrowDown className="size-3 text-gold-light ml-1 inline" />
    ) : (
      <ArrowUp className="size-3 text-gold-light ml-1 inline" />
    );
  };

  const TH_BASE =
    'px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted select-none';

  return (
    <div className="rounded-2xl border border-gold/15 bg-card/50 shadow-md backdrop-blur-md overflow-hidden">
      {totalFiltered === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={Inbox}
            title="No matching alerts found"
            description="No alert records match your current filter and search criteria."
            action={
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors"
              >
                Reset filters
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[65rem] text-left text-sm">
              <thead className="border-b border-gold/15 bg-canvas/60">
                <tr>
                  {/* Priority */}
                  <th
                    scope="col"
                    className={`${TH_BASE} cursor-pointer hover:text-ink transition-colors`}
                    onClick={() => onSortChange('priority')}
                  >
                    Priority {renderSortIcon('priority')}
                  </th>

                  {/* Ring ID */}
                  <th scope="col" className={TH_BASE}>
                    Ring ID
                  </th>

                  {/* Typology */}
                  <th scope="col" className={TH_BASE}>
                    Typology
                  </th>

                  {/* Risk Score */}
                  <th
                    scope="col"
                    className={`${TH_BASE} cursor-pointer hover:text-ink transition-colors`}
                    onClick={() => onSortChange('score')}
                  >
                    Risk Score {renderSortIcon('score')}
                  </th>

                  {/* Amount at Risk */}
                  <th
                    scope="col"
                    className={`${TH_BASE} text-right cursor-pointer hover:text-ink transition-colors`}
                    onClick={() => onSortChange('amount_at_risk')}
                  >
                    At Risk {renderSortIcon('amount_at_risk')}
                  </th>

                  {/* Total Moved */}
                  <th
                    scope="col"
                    className={`${TH_BASE} text-right cursor-pointer hover:text-ink transition-colors`}
                    onClick={() => onSortChange('amount_moved')}
                  >
                    Total Moved {renderSortIcon('amount_moved')}
                  </th>

                  {/* Accounts */}
                  <th scope="col" className={`${TH_BASE} text-right`}>
                    Accounts
                  </th>

                  {/* Duration */}
                  <th scope="col" className={`${TH_BASE} text-right`}>
                    Duration
                  </th>

                  {/* Status */}
                  <th scope="col" className={TH_BASE}>
                    Status
                  </th>

                  {/* Assignee */}
                  <th scope="col" className={TH_BASE}>
                    Assignee
                  </th>

                  {/* Detected At */}
                  <th
                    scope="col"
                    className={`${TH_BASE} text-right cursor-pointer hover:text-ink transition-colors`}
                    onClick={() => onSortChange('detected_at')}
                  >
                    Detected {renderSortIcon('detected_at')}
                  </th>

                  {/* Actions */}
                  <th scope="col" className={`${TH_BASE} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/8">
                {paginatedAlerts.map((alert, index) => (
                  <AlertRow
                    key={alert.ring_id}
                    alert={alert}
                    index={index}
                    isSelected={selectedAlert?.ring_id === alert.ring_id}
                    isNew={newAlertIds?.has(alert.ring_id)}
                    onSelect={onSelectAlert}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden divide-y divide-gold/10 p-3 space-y-3">
            {paginatedAlerts.map((alert) => (
              <div
                key={alert.ring_id}
                onClick={() => onSelectAlert(alert)}
                className={`rounded-xl border p-4 space-y-3 transition-colors cursor-pointer ${
                  selectedAlert?.ring_id === alert.ring_id
                    ? 'border-gold/50 bg-gold/15'
                    : 'border-gold/15 bg-canvas/50 hover:bg-canvas/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gold-light">
                      {alert.ring_id}
                    </span>
                    <RingStatusPill status={alert.status} />
                  </div>
                  <span className="text-xs text-muted font-mono">
                    {formatRelativeTime(alert.detected_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <TypologyBadge typology={alert.ring_type} />
                  <RiskScoreMeter score={alert.score} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-gold/10 pt-2">
                  <div>
                    <span className="text-muted">At Risk: </span>
                    <span className="font-mono font-semibold text-gold-light">
                      {formatInrCompact(alert.amount_at_risk)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted">Moved: </span>
                    <span className="font-mono text-ink">
                      {formatInrCompact(alert.amount_moved)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted">Accounts: </span>
                    <span className="font-mono text-ink">
                      {alert.n_accounts} ({alert.n_victims} victims)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted">Duration: </span>
                    <span className="font-mono text-ink">{alert.duration_min}m</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gold/10 pt-2">
                  <AssigneeAvatar assignee={alert.assigned_to} size="sm" />
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-light">
                    <Eye className="size-3" /> Inspect
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gold/15 bg-canvas/40 px-4 py-3 text-xs text-muted">
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <strong className="text-ink">{startIndex + 1}</strong> to{' '}
                <strong className="text-ink">
                  {Math.min(startIndex + pageSize, totalFiltered)}
                </strong>{' '}
                of <strong className="text-ink">{totalFiltered}</strong> alerts
              </span>

              <div className="hidden sm:flex items-center gap-1.5 ml-3">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    onPageSizeChange(Number(e.target.value));
                    onPageChange(1);
                  }}
                  className="rounded-lg border border-gold/20 bg-canvas px-2 py-1 text-xs text-ink focus:border-gold"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-gold/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-1 px-1 font-mono text-xs text-ink">
                <span>{page}</span>
                <span className="text-muted">/</span>
                <span>{totalPages}</span>
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-gold/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
