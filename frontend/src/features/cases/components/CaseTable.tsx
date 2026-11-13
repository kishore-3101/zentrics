import { ChevronLeft, ChevronRight, ExternalLink, Eye, Inbox, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { AssigneeAvatar } from '../../alerts/components/AssigneeAvatar';
import { formatInrCompact, formatRelativeTime } from '../../../lib/formatters';
import type { CaseRecord } from '../../../types/cases';

interface CaseTableProps {
  cases: CaseRecord[];
  selectedCase: CaseRecord | null;
  onSelectCase: (caseRecord: CaseRecord) => void;
  onOpenReassign: (caseRecord: CaseRecord) => void;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  totalFiltered: number;
  onResetFilters: () => void;
}

export function CaseTable({
  cases,
  selectedCase,
  onSelectCase,
  onOpenReassign,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalFiltered,
  onResetFilters,
}: CaseTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedCases = cases.slice(startIndex, startIndex + pageSize);

  const TH =
    'px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted select-none';

  return (
    <div className="rounded-2xl border border-gold/15 bg-card/50 shadow-md backdrop-blur-md overflow-hidden">
      {totalFiltered === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={Inbox}
            title="No matching cases found"
            description="No cases match your active search and filter criteria."
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
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[65rem] text-left text-sm">
              <thead className="border-b border-gold/15 bg-canvas/60">
                <tr>
                  <th scope="col" className={TH}>Case #</th>
                  <th scope="col" className={TH}>Ring ID</th>
                  <th scope="col" className={TH}>Typology</th>
                  <th scope="col" className={TH}>Severity</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={TH}>Assigned Analyst</th>
                  <th scope="col" className={`${TH} text-right`}>At Risk / Moved</th>
                  <th scope="col" className={`${TH} text-right`}>Audit Events</th>
                  <th scope="col" className={`${TH} text-right`}>Last Activity</th>
                  <th scope="col" className={`${TH} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/8">
                {paginatedCases.map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => onSelectCase(c)}
                    className={`group cursor-pointer transition-colors ${
                      selectedCase?.case_id === c.case_id
                        ? 'bg-gold/15 hover:bg-gold/20'
                        : 'hover:bg-white/4'
                    }`}
                  >
                    {/* Case ID */}
                    <td className="px-3.5 py-3 whitespace-nowrap font-mono text-sm font-bold text-gold-light">
                      #{c.case_id}
                    </td>

                    {/* Ring ID */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <Link
                        to={`/rings/${encodeURIComponent(c.ring_id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-ink hover:text-gold-light hover:underline"
                        title="Open in 3D Ring Explorer"
                      >
                        {c.ring_id}
                        <ExternalLink className="size-3 text-muted/60" />
                      </Link>
                    </td>

                    {/* Typology */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <TypologyBadge typology={c.ring_type} />
                    </td>

                    {/* Severity / Score */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <RiskScoreMeter score={c.score} />
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <RingStatusPill status={c.status} />
                    </td>

                    {/* Assigned Analyst */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <AssigneeAvatar assignee={c.assigned_to} size="sm" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReassign(c);
                          }}
                          title="Assign or reassign analyst"
                          className="rounded p-1 text-muted hover:text-gold-light hover:bg-white/5 opacity-70 group-hover:opacity-100 transition-opacity"
                        >
                          <UserPlus className="size-3" />
                        </button>
                      </div>
                    </td>

                    {/* At Risk / Moved */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-semibold text-gold-light tabular-nums">
                          {formatInrCompact(c.amount_at_risk)}
                        </span>
                        <span className="font-mono text-[10px] text-muted tabular-nums">
                          of {formatInrCompact(c.amount_moved)}
                        </span>
                      </div>
                    </td>

                    {/* Audit Events Count */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono text-xs text-ink/80 tabular-nums">
                      {c.actions_count} {c.actions_count === 1 ? 'log' : 'logs'}
                    </td>

                    {/* Last Activity */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono text-xs text-muted">
                      {formatRelativeTime(c.updated_at)}
                    </td>

                    {/* Action button */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(c);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2 py-1 text-xs font-semibold text-gold-light opacity-80 group-hover:opacity-100 group-hover:border-gold/50 hover:bg-gold/10"
                      >
                        <Eye className="size-3" />
                        Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden divide-y divide-gold/10 p-3 space-y-3">
            {paginatedCases.map((c) => (
              <div
                key={c.case_id}
                onClick={() => onSelectCase(c)}
                className={`rounded-xl border p-4 space-y-3 transition-colors cursor-pointer ${
                  selectedCase?.case_id === c.case_id
                    ? 'border-gold/50 bg-gold/15'
                    : 'border-gold/15 bg-canvas/50 hover:bg-canvas/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gold-light">
                      #{c.case_id} &bull; {c.ring_id}
                    </span>
                    <RingStatusPill status={c.status} />
                  </div>
                  <span className="text-xs text-muted font-mono">
                    {formatRelativeTime(c.updated_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <TypologyBadge typology={c.ring_type} />
                  <RiskScoreMeter score={c.score} />
                </div>

                <div className="flex items-center justify-between border-t border-gold/10 pt-2 text-xs">
                  <AssigneeAvatar assignee={c.assigned_to} size="sm" />
                  <span className="font-mono text-gold-light font-semibold">
                    {formatInrCompact(c.amount_at_risk)} at risk
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gold/15 bg-canvas/40 px-4 py-3 text-xs text-muted">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-ink">{startIndex + 1}</strong> to{' '}
                <strong className="text-ink">{Math.min(startIndex + pageSize, totalFiltered)}</strong> of{' '}
                <strong className="text-ink">{totalFiltered}</strong> cases
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
