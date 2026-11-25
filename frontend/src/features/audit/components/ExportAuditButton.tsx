import { Download } from 'lucide-react';
import type { AuditLogEntry } from '../../../types/cases';

interface ExportAuditButtonProps {
  entries: AuditLogEntry[];
}

export function ExportAuditButton({ entries }: ExportAuditButtonProps) {
  const handleExport = () => {
    if (entries.length === 0) return;

    const headers = [
      'Action ID',
      'Timestamp (UTC)',
      'Case ID',
      'Ring ID',
      'Ring Typology',
      'Action',
      'From Status',
      'To Status',
      'Actor',
      'Notes',
    ];

    const csvRows = entries.map((e) => {
      const escape = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      return [
        escape(e.action_id),
        escape(e.ts),
        escape(e.case_id),
        escape(e.ring_id),
        escape(e.ring_type),
        escape(e.action),
        escape(e.from_status || 'none'),
        escape(e.to_status || 'none'),
        escape(e.actor),
        escape(e.note || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `zentrics-compliance-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={entries.length === 0}
      className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold-light hover:bg-gold/20 disabled:opacity-40 transition-colors"
      title="Export visible audit records to CSV for compliance reporting"
    >
      <Download className="size-3.5" />
      Export CSV ({entries.length})
    </button>
  );
}
