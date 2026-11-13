import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { THEME } from '../../../lib/theme';
import type { CurvePoint } from '../../../types/metrics';

interface PrRocCurvesChartProps {
  prCurve: CurvePoint[];
  rocCurve: CurvePoint[];
  selectedThreshold?: number;
  onSelectThreshold?: (threshold: number) => void;
}

interface CurveTooltipProps {
  active?: boolean;
  payload?: readonly {
    payload?: CurvePoint;
  }[];
  isPrCurve: boolean;
}

function CurveTooltip({ active, payload, isPrCurve }: CurveTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-gold/25 bg-sidebar/95 p-3 shadow-panel backdrop-blur-md text-xs space-y-1">
      <div className="flex items-center justify-between gap-4 font-mono text-[11px] text-gold-light border-b border-gold/15 pb-1">
        <span>Decision Threshold</span>
        <strong>T = {point.threshold.toFixed(2)}</strong>
      </div>
      {isPrCurve ? (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Precision:</span>
            <span className="font-mono font-bold text-emerald">{point.precision.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Recall:</span>
            <span className="font-mono font-bold text-gold-light">{point.recall.toFixed(1)}%</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-muted">True Positive Rate (TPR):</span>
            <span className="font-mono font-bold text-emerald">{point.tpr.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">False Positive Rate (FPR):</span>
            <span className="font-mono font-bold text-danger">{point.fpr.toFixed(1)}%</span>
          </div>
        </>
      )}
      {point.threshold === 0.6 && (
        <div className="mt-1 border-t border-gold/10 pt-1 text-[10px] text-emerald font-semibold">
          &bull; Calibrated Operating Point (T = 0.60)
        </div>
      )}
    </div>
  );
}

export function PrRocCurvesChart({
  prCurve,
  rocCurve,
  selectedThreshold = 0.6,
  onSelectThreshold,
}: PrRocCurvesChartProps) {
  const [activeCurve, setActiveCurve] = useState<'pr' | 'roc'>('pr');

  const isPr = activeCurve === 'pr';
  const data = isPr ? prCurve : rocCurve;

  return (
    <DashboardCard bodyClassName="p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gold/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">
              {isPr ? 'Precision-Recall Curve' : 'Receiver Operating Characteristic (ROC)'}
            </h3>
            <span className="rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald">
              {isPr ? 'PR-AUC: 0.971' : 'ROC-AUC: 0.988'}
            </span>
          </div>
          <p className="text-xs text-muted">
            {isPr
              ? 'Precision vs recall trade-off across empirical decision thresholds (0.1 to 0.9).'
              : 'True Positive Rate vs False Positive Rate for benign-vs-mule discrimination.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="inline-flex rounded-xl border border-gold/20 bg-canvas/60 p-1">
          <button
            type="button"
            onClick={() => setActiveCurve('pr')}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              isPr
                ? 'bg-gold/20 text-gold-light shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            PR Curve
          </button>
          <button
            type="button"
            onClick={() => setActiveCurve('roc')}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              !isPr
                ? 'bg-gold/20 text-gold-light shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            ROC Curve
          </button>
        </div>
      </div>

      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
            onClick={(state: any) => {
              const activePayload = state?.activePayload?.[0]?.payload as CurvePoint | undefined;
              if (activePayload && onSelectThreshold) {
                onSelectThreshold(activePayload.threshold);
              }
            }}
          >
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={THEME.emerald} stopOpacity={0.35} />
                <stop offset="95%" stopColor={THEME.emerald} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(201, 168, 91, 0.08)" vertical={false} />
            <XAxis
              dataKey={isPr ? 'recall' : 'fpr'}
              stroke="#8B9B8F"
              tick={{ fill: '#8B9B8F', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(201, 168, 91, 0.2)' }}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: isPr ? 'Recall (%)' : 'False Positive Rate (%)',
                position: 'insideBottom',
                offset: -2,
                fill: '#8B9B8F',
                fontSize: 10,
              }}
            />
            <YAxis
              domain={[60, 100]}
              stroke="#8B9B8F"
              tick={{ fill: '#8B9B8F', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(201, 168, 91, 0.2)' }}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: isPr ? 'Precision (%)' : 'True Positive Rate (%)',
                angle: -90,
                position: 'insideLeft',
                offset: 20,
                fill: '#8B9B8F',
                fontSize: 10,
              }}
            />
            <Tooltip content={<CurveTooltip isPrCurve={isPr} />} />
            <Area
              type="monotone"
              dataKey={isPr ? 'precision' : 'tpr'}
              stroke={THEME.emerald}
              strokeWidth={2.5}
              fill="url(#curveGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gold/10 pt-2 text-[11px] text-muted gap-1">
        <span>
          Selected Threshold:{' '}
          <strong className="text-gold-light font-mono">T = {selectedThreshold.toFixed(2)}</strong>
          {selectedThreshold === 0.6 && ' (Operating Default)'}
        </span>
        <span className="text-emerald font-semibold">
          {isPr
            ? 'PR-AUC = 0.971 (vs 0.492 Baseline Rules)'
            : 'ROC-AUC = 0.988 (vs 0.500 Random Chance)'}
        </span>
      </div>
    </DashboardCard>
  );
}
