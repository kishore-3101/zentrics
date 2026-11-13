import { motion } from 'motion/react';
import { ArrowRight, Network } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { formatInrCompact } from '../../../lib/formatters';
import type { OverviewRing } from '../types';

const detailsPath = (ringId: string) => `/rings/${encodeURIComponent(ringId)}`;

function ViewDetailsLink({ ringId, className }: { ringId: string; className?: string }) {
  return (
    <Link
      to={detailsPath(ringId)}
      aria-label={`View details for ring ${ringId}`}
      className={`group inline-flex items-center gap-1.5 rounded-lg border border-gold/25 px-3 py-1.5 text-xs font-semibold text-gold-light transition-colors duration-200 hover:border-gold/55 hover:bg-gold/10 ${className ?? ''}`}
    >
      View details
      <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted';

interface TopCriticalRingsTableProps {
  rings: readonly OverviewRing[];
  delay?: number;
  className?: string;
}

export function TopCriticalRingsTable({ rings, delay = 0, className }: TopCriticalRingsTableProps) {
  return (
    <DashboardCard
      title="Top 5 Critical Rings"
      description="Ranked by risk score for quick triage"
      delay={delay}
      className={className}
      bodyClassName="px-2 pb-3 pt-3 sm:px-3"
      action={
        <Link
          to="/alerts"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-gold-light"
        >
          All alerts
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      {rings.length === 0 ? (
        <EmptyState icon={Network} title="No critical rings" description="Rings will be ranked here as soon as they are detected." />
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Top five critical mule rings ranked by risk score</caption>
              <thead>
                <tr className="border-b border-gold/10">
                  <th scope="col" className={TH}>Ring ID</th>
                  <th scope="col" className={TH}>Typology</th>
                  <th scope="col" className={TH}>Risk score</th>
                  <th scope="col" className={`${TH} text-right`}>Total moved</th>
                  <th scope="col" className={`${TH} text-right`}>Accounts</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={`${TH} text-right`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/8">
                {rings.map((ring, index) => (
                  <motion.tr
                    key={ring.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: delay + 0.2 + index * 0.06 }}
                    className="transition-colors duration-200 hover:bg-white/3"
                  >
                    <td className="px-3 py-3.5 font-mono text-sm font-semibold text-gold-light">{ring.id}</td>
                    <td className="px-3 py-3.5"><TypologyBadge typology={ring.typology} /></td>
                    <td className="px-3 py-3.5"><RiskScoreMeter score={ring.riskScore} /></td>
                    <td className="px-3 py-3.5 text-right font-mono tabular-nums text-ink">{formatInrCompact(ring.totalMoved)}</td>
                    <td className="px-3 py-3.5 text-right font-mono tabular-nums text-ink">{ring.accountCount}</td>
                    <td className="px-3 py-3.5"><RingStatusPill status={ring.status} /></td>
                    <td className="px-3 py-3.5 text-right"><ViewDetailsLink ringId={ring.id} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="space-y-3 p-2 md:hidden">
            {rings.map((ring, index) => (
              <motion.li
                key={ring.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: delay + 0.15 + index * 0.06 }}
                className="rounded-xl border border-gold/12 bg-canvas/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-gold-light">{ring.id}</span>
                  <RingStatusPill status={ring.status} />
                </div>
                <div className="mt-3"><TypologyBadge typology={ring.typology} /></div>
                <RiskScoreMeter score={ring.riskScore} className="mt-3" />
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted">Total moved</dt>
                    <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{formatInrCompact(ring.totalMoved)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Accounts</dt>
                    <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{ring.accountCount}</dd>
                  </div>
                </dl>
                <ViewDetailsLink ringId={ring.id} className="mt-4 w-full justify-center" />
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
