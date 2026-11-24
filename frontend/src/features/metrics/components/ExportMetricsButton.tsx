import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import type { MetricsDataset } from '../../../types/metrics';

interface ExportMetricsButtonProps {
  data: MetricsDataset;
}

export function ExportMetricsButton({ data }: ExportMetricsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportJSON = () => {
    const payload = {
      designation: 'BENCHMARK EVALUATION REPORT',
      provenance: 'TraceMesh Production Evaluation Split',
      protocol: 'Evaluation Harness with clean labels & 70% ring recall threshold',
      exported_at: new Date().toISOString(),
      dataset: data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zentrics-benchmark-run4-simulated-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const exportCSV = () => {
    const lines: string[] = [
      '# DESIGNATION,BENCHMARK EVALUATION REPORT',
      '# PROVENANCE,TraceMesh Production Evaluation Split',
      `# EXPORTED_AT,${new Date().toISOString()}`,
      '',
      '--- OVERALL SUMMARY METRICS ---',
      'Metric,Value,Unit',
      `Precision,${data.overall.precision},%`,
      `Recall,${data.overall.recall},%`,
      `F1 Score,${data.overall.f1},%`,
      `PR-AUC,${data.overall.pr_auc},score (0-1)`,
      `Ring Recall @ 70%,${data.overall.ring_recall},%`,
      `False Positive Rate,${data.overall.fpr},%`,
      '',
      '--- FOUR-WAY MODEL ARCHITECTURAL COMPARISON ---',
      'Metric,Baseline Rules (%),Graph Rules (%),Tabular ML Only (%),Zentrics Full Fusion (%),Full Fusion Lead (pp)',
      ...data.comparison.map(
        (c) =>
          `"${c.metric}",${c.baseline_rules},${c.graph_rules},${c.ml_only},${c.full_fusion},${(
            c.full_fusion - c.baseline_rules
          ).toFixed(1)} pp`,
      ),
      '',
      '--- TYPOLOGY & DIFFICULTY BREAKDOWN ---',
      'Typology,Difficulty Tier,Recall (%),F1 Score (%),Sample Size (rings)',
      ...data.typologyBreakdown.map(
        (t) => `"${t.typology}",${t.difficulty},${t.recall},${t.f1},${t.sample_size}`,
      ),
      '',
      '--- DEMOGRAPHIC FAIRNESS EVALUATION ---',
      'Dimension,Cohort Group,Normal FPR (%),Hard-Negative FPR (%),Parity Gap (pp)',
      ...data.fairness.map(
        (f) => `"${f.dimension}","${f.group}",${f.normal_fpr},${f.hard_negative_fpr},${f.parity_gap}`,
      ),
      '',
      '--- OPERATIONAL IMPACT (ALERT REDUCTION) ---',
      'Parameter,Value',
      `Total Raw Account Alerts,${data.operationalImpact.totalAccountAlerts}`,
      `Consolidated Ring Cases,${data.operationalImpact.consolidatedRings}`,
      `Alert Fatigue Reduction,${data.operationalImpact.reductionPercentage}%`,
      `Simulated Money Saved (INR),₹${data.operationalImpact.simulatedMoneySaved.toLocaleString('en-IN')}`,
    ];

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zentrics-benchmark-run4-simulated-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors"
        title="Export benchmark evaluation metrics and provenance metadata"
      >
        <Download className="size-3.5" />
        Export Benchmark
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50 w-52 rounded-xl border border-gold/30 bg-card p-1.5 shadow-2xl backdrop-blur-md space-y-1 animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={exportCSV}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-gold/15 hover:text-gold-light transition-colors text-left"
            >
              <FileSpreadsheet className="size-4 text-emerald" />
              <div>
                <p>Export as CSV</p>
                <p className="text-[10px] text-muted">Summary &amp; comparison tables</p>
              </div>
            </button>
            <button
              type="button"
              onClick={exportJSON}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-gold/15 hover:text-gold-light transition-colors text-left"
            >
              <FileJson className="size-4 text-gold-light" />
              <div>
                <p>Export as JSON</p>
                <p className="text-[10px] text-muted">Full dataset + curve artifacts</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
