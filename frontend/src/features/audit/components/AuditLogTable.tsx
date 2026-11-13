import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Lock,
  MessageSquare,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { formatRelativeTime } from '../../../lib/formatters';
import type { AuditLogEntry } from '../../../types/cases';

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  onSelectEntry: (entry: AuditLogEntry) => void;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  totalFiltered: number;
  onResetFilters: () => void;
}

export function AuditLogTable({
  logs,
  onSelectEntry,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalFiltered,
  onResetFilters,
}: AuditLogTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedLogs = logs.slice(startIndex, startIndex + pageSize);

  const getActionBadge = (action: AuditLogEntry['action'], note: string | null) => {
    switch (action) {
      case 'freeze':
        return {
          icon: Lock,
          label: 'Freeze',
          chip: 'border-danger/40 bg-danger/10 text-danger',
        };
      case 'escalate':
        return {
          icon: AlertTriangle,
          label: 'Escalate',
          chip: 'border-warning/40 bg-warning/10 text-warning',
        };
      case 'false_positive':
        return {
          icon: ShieldCheck,
          label: 'False Positive',
          chip: 'border-muted/40 bg-muted/10 text-muted',
        };
      case 'status_change':
        return {
          icon: ArrowRight,
          label: 'Status Change',
          chip: 'border-emerald/40 bg-emerald/10 text-emerald',
        };
      case 'note':
      default:
        return {
          icon: note?.startsWith('Reassignment:') ? User : MessageSquare,
          label: note?.startsWith('Reassignment:') ? 'Reassigned' : 'Note',
          chip: 'border-gold/40 bg-gold/10 text-gold-light',
        };
    }
  };

  const TH =
    'px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted select-none';

  return (
    <div className="rounded-2xl border border-gold/15 bg-card/50 shadow-md backdrop-blur-md overflow-hidden">
      {totalFiltered === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={Inbox}
            title="No matching audit records"
            description="No compliance events match your current filter and date criteria."
            action={
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold-light hover:bg-gold/20"
              >
                Reset filters
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[65rem] text-left text-sm">
              <thead className="border-b border-gold/15 bg-canvas/60">
                <tr>
                  <th scope="col" className={TH}>Action #</th>
                  <th scope="col" className={TH}>Timestamp (UTC)</th>
                  <th scope="col" className={TH}>Case & Ring</th>
                  <th scope="col" className={TH}>Action Type</th>
                  <th scope="col" className={TH}>State Transition</th>
                  <th scope="col" className={TH}>Actor</th>
                  <th scope="col" className={TH}>Analyst Notes / Rationale</th>
                  <th scope="col" className={`${TH} text-right`}>
                    <span className="sr-only">Inspect</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/8">
                {paginatedLogs.map((entry) => {
                  const badge = getActionBadge(entry.action, entry.note);
                  const Icon = badge.icon;

                  return (
                    <tr
                      key={entry.action_id}
                      onClick={() => onSelectEntry(entry)}
                      className="group cursor-pointer transition-colors hover:bg-white/4"
                    >
                      {/* Action ID */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono text-xs font-bold text-gold-light">
                        #{entry.action_id}
                      </td>

                      {/* Timestamp */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-ink/90">
                            {new Date(entry.ts).toISOString().replace('T', ' ').slice(0, 19)}
                          </span>
                          <span className="text-[10px] text-muted">
                            {formatRelativeTime(entry.ts)}
                          </span>
                        </div>
                      </td>

                      {/* Case & Ring */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink">
                            Case #{entry.case_id}
                          </span>
                          <span className="text-muted/40">&bull;</span>
                          <Link
                            to={`/rings/${encodeURIComponent(entry.ring_id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-xs text-gold-light hover:underline"
                            title="Open in 3D Ring Explorer"
                          >
                            {entry.ring_id}
                          </Link>
                        </div>
                      </td>

                      {/* Action Type Badge */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.chip}`}
                        >
                          <Icon className="size-3" />
                          {badge.label}
                        </span>
                      </td>

                      {/* State Transition */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {entry.from_status || entry.to_status ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            {entry.from_status ? (
                              <RingStatusPill status={entry.from_status} />
                            ) : (
                              <span className="text-[11px] text-muted font-mono">init</span>
                            )}
                            <ArrowRight className="size-3 text-gold-light shrink-0" />
                            {entry.to_status ? (
                              <RingStatusPill status={entry.to_status} />
                            ) : (
                              <span className="text-[11px] text-muted font-mono">none</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted font-mono">—</span>
                        )}
                      </td>

                      {/* Actor */}
                      <td className="px-3.5 py-3 whitespace-nowrap text-xs font-medium text-ink">
                        {entry.actor}
                      </td>

                      {/* Analyst Notes */}
                      <td className="px-3.5 py-3 max-w-xs truncate text-xs text-muted group-hover:text-ink/80">
                        {entry.note || <span className="italic text-muted/50">No notes recorded</span>}
                      </td>

                      {/* Inspect Trigger */}
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEntry(entry);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2 py-1 text-xs font-semibold text-gold-light opacity-80 group-hover:opacity-100 hover:bg-gold/10"
                        >
                          <Eye className="size-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-gold/10 p-3 space-y-3">
            {paginatedLogs.map((entry) => {
              const badge = getActionBadge(entry.action, entry.note);
              const Icon = badge.icon;

              return (
                <div
                  key={entry.action_id}
                  onClick={() => onSelectEntry(entry)}
                  className="rounded-xl border border-gold/15 bg-canvas/50 p-4 space-y-3 cursor-pointer hover:bg-canvas/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gold-light">
                        #{entry.action_id} &bull; Case #{entry.case_id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.chip}`}
                      >
                        <Icon className="size-2.5" />
                        {badge.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted font-mono">
                      {formatRelativeTime(entry.ts)}
                    </span>
                  </div>

                  <div className="text-xs text-ink/80 line-clamp-2">
                    {entry.note || <span className="italic text-muted">No notes recorded</span>}
                  </div>

                  <div className="flex items-center justify-between border-t border-gold/10 pt-2 text-xs">
                    <span className="text-muted">{entry.actor}</span>
                    <span className="font-mono text-gold-light">{entry.ring_id}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gold/15 bg-canvas/40 px-4 py-3 text-xs text-muted">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-ink">{startIndex + 1}</strong> to{' '}
                <strong className="text-ink">{Math.min(startIndex + pageSize, totalFiltered)}</strong> of{' '}
                <strong className="text-ink">{totalFiltered}</strong> records
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
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-gold/10 disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <div className="px-1 font-mono text-xs text-ink">
                {page} / {totalPages}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-gold/10 disabled:opacity-40"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
