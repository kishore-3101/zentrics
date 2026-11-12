import { motion } from 'motion/react';
import { Eye } from 'lucide-react';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { formatInrCompact, formatRelativeTime } from '../../../lib/formatters';
import type { AlertRecord } from '../../../types/alerts';
import { AssigneeAvatar } from './AssigneeAvatar';

interface AlertRowProps {
  alert: AlertRecord;
  isSelected: boolean;
  isNew?: boolean;
  onSelect: (alert: AlertRecord) => void;
  index: number;
}

export function AlertRow({ alert, isSelected, isNew, onSelect, index }: AlertRowProps) {
  // Format duration
  const durationText =
    alert.duration_min >= 60
      ? `${(alert.duration_min / 60).toFixed(1)}h`
      : `${alert.duration_min}m`;

  return (
    <motion.tr
      onClick={() => onSelect(alert)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className={`group cursor-pointer border-b border-gold/10 transition-colors duration-150 ${
        isSelected
          ? 'bg-gold/15 hover:bg-gold/20'
          : isNew
            ? 'bg-emerald/15 animate-pulse'
            : 'hover:bg-white/4'
      }`}
    >
      {/* 1. Priority Indicator */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span
            className={`h-5 w-1 rounded-full ${
              alert.score >= 80
                ? 'bg-danger shadow-glow-danger'
                : alert.score >= 60
                  ? 'bg-gold shadow-glow-gold'
                  : 'bg-emerald shadow-glow-emerald'
            }`}
          />
          <span className="font-mono text-xs font-semibold tabular-nums text-muted">
            {Math.round(alert.priority / 1000)}k
          </span>
        </div>
      </td>

      {/* 2. Ring ID */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <span className="font-mono text-sm font-semibold text-gold-light group-hover:underline">
          {alert.ring_id}
        </span>
      </td>

      {/* 3. Typology Badge */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <TypologyBadge typology={alert.ring_type} />
      </td>

      {/* 4. Risk Score */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <RiskScoreMeter score={alert.score} />
      </td>

      {/* 5. Amount at Risk */}
      <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono text-sm font-semibold text-gold-light tabular-nums">
        {formatInrCompact(alert.amount_at_risk)}
      </td>

      {/* 6. Total Moved */}
      <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono text-xs text-muted tabular-nums">
        {formatInrCompact(alert.amount_moved)}
      </td>

      {/* 7. Accounts Involved */}
      <td className="px-3.5 py-3 text-right whitespace-nowrap">
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs font-medium text-ink tabular-nums">
            {alert.n_accounts}
          </span>
          {alert.n_victims > 0 && (
            <span className="text-[10px] text-emerald tabular-nums">
              {alert.n_victims} victim{alert.n_victims > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </td>

      {/* 8. Duration */}
      <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono text-xs text-muted tabular-nums">
        {durationText}
      </td>

      {/* 9. Status Pill */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <RingStatusPill status={alert.status} />
      </td>

      {/* 10. Assignee */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <AssigneeAvatar assignee={alert.assigned_to} size="sm" />
      </td>

      {/* 11. Detected Timestamp */}
      <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono text-xs text-muted">
        <span title={new Date(alert.detected_at).toUTCString()}>
          {formatRelativeTime(alert.detected_at)}
        </span>
      </td>

      {/* Action Chevron */}
      <td className="px-3.5 py-3 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(alert);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-gold/20 px-2 py-1 text-xs font-semibold text-gold-light opacity-80 group-hover:opacity-100 group-hover:border-gold/50 hover:bg-gold/10 transition-all"
        >
          <Eye className="size-3" />
          <span className="hidden xl:inline">Details</span>
        </button>
      </td>
    </motion.tr>
  );
}
