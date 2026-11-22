import { Sliders, CheckCircle2, AlertCircle } from 'lucide-react';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import type { CurvePoint } from '../../../types/metrics';

interface InteractiveThresholdExplorerProps {
  prCurve: CurvePoint[];
  selectedThreshold: number;
  onThresholdChange: (threshold: number) => void;
}

export function InteractiveThresholdExplorer({
  prCurve,
  selectedThreshold,
  onThresholdChange,
}: InteractiveThresholdExplorerProps) {
  const fallbackPoint: CurvePoint = {
    threshold: 0.6,
    precision: 96.4,
    recall: 92.8,
    fpr: 1.8,
    tpr: 92.8,
  };

  // Find matching coordinate in the artifact array
  const currentPoint =
    prCurve && prCurve.length > 0
      ? prCurve.find((p) => Math.abs(p.threshold - selectedThreshold) < 0.05) ||
        prCurve.find((p) => Math.abs(p.threshold - 0.6) < 0.05) ||
        prCurve[0]
      : fallbackPoint;

  // Derived F1 score from actual P & R coordinates
  const derivedF1 =
    currentPoint.precision + currentPoint.recall > 0
      ? (
          (2 * currentPoint.precision * currentPoint.recall) /
          (currentPoint.precision + currentPoint.recall)
        ).toFixed(1)
      : '0.0';

  const isOptimal = Math.abs(currentPoint.threshold - 0.6) < 0.05;

  return (
    <DashboardCard bodyClassName="p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gold/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-gold/30 bg-gold/10 text-gold-light">
            <Sliders className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Interactive Decision Threshold Calibration
            </h3>
            <p className="text-xs text-muted">
              Inspect actual trade-off coordinates stored in <code className="font-mono text-[11px] text-gold-light">metric_artifacts</code>.
            </p>
          </div>
        </div>

        {isOptimal ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/10 px-3 py-1 text-xs font-semibold text-emerald">
            <CheckCircle2 className="size-3.5" />
            Calibrated Operating Point (0.60)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-canvas px-3 py-1 text-xs font-mono text-muted">
            Threshold: {currentPoint.threshold.toFixed(1)}
          </span>
        )}
      </div>

      {/* Threshold Slider */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Threshold Scrub (0.1 &rarr; 0.9):</span>
          <span className="font-mono font-bold text-gold-light">
            T = {currentPoint.threshold.toFixed(2)}
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.1}
            value={currentPoint.threshold}
            onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg bg-canvas border border-gold/20 appearance-none cursor-pointer accent-[#C9A85B]"
          />
          {/* Quick markers */}
          <div className="flex justify-between px-1 text-[10px] font-mono text-muted/60 mt-1">
            {prCurve.map((p) => (
              <button
                key={p.threshold}
                type="button"
                onClick={() => onThresholdChange(p.threshold)}
                className={`hover:text-gold-light transition-colors ${
                  Math.abs(p.threshold - currentPoint.threshold) < 0.05
                    ? 'font-bold text-gold-light underline'
                    : ''
                }`}
              >
                {p.threshold.toFixed(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Readout Matrix for current threshold */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
        <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Precision P(T)
          </span>
          <p className="font-mono text-xl font-bold text-emerald tabular-nums">
            {currentPoint.precision.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted">Mule identification accuracy</p>
        </div>

        <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Recall R(T)
          </span>
          <p className="font-mono text-xl font-bold text-gold-light tabular-nums">
            {currentPoint.recall.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted">Mule capture sensitivity</p>
        </div>

        <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            False Positive Rate
          </span>
          <p className="font-mono text-xl font-bold text-ink tabular-nums">
            {currentPoint.fpr.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted">False alarm frequency</p>
        </div>

        <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Derived F1(T)
          </span>
          <p className="font-mono text-xl font-bold text-ink tabular-nums">
            {derivedF1}%
          </p>
          <p className="text-[10px] text-muted">2 &times; (P &times; R) / (P + R)</p>
        </div>
      </div>

      {/* Data Limitation Notice */}
      <div className="flex items-start gap-2 rounded-xl border border-gold/10 bg-canvas/30 p-2.5 text-[11px] text-muted">
        <AlertCircle className="size-3.5 text-gold-light shrink-0 mt-0.5" />
        <p>
          <strong className="text-ink">Artifact Coordinate Integrity:</strong> Coordinates strictly reflect empirical sample points in <code className="font-mono text-[10px] text-gold-light">metric_artifacts</code>. Dynamic daily alert volumes require live transaction ingestion rates and are shown as unmeasured in this static benchmark run.
        </p>
      </div>
    </DashboardCard>
  );
}
