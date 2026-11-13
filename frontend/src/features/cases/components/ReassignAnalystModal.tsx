import { UserCheck, X } from 'lucide-react';
import React, { useState } from 'react';
import type { CaseRecord } from '../../../types/cases';

interface ReassignAnalystModalProps {
  caseRecord: CaseRecord;
  isOpen: boolean;
  onClose: () => void;
  onReassign: (newAssignee: string) => Promise<void>;
}

const ANALYST_CHOICES = [
  'P. Sharma (Senior AML Lead)',
  'A. Verma (Lead Fraud Investigator)',
  'R. Iyer (Specialist & Compliance Liaison)',
  'S. Nair (Cyber Crime Analyst)',
];

export function ReassignAnalystModal({
  caseRecord,
  isOpen,
  onClose,
  onReassign,
}: ReassignAnalystModalProps) {
  const [selectedAnalyst, setSelectedAnalyst] = useState(
    caseRecord.assigned_to || ANALYST_CHOICES[0],
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onReassign(selectedAnalyst);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gold/15 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-gold-light" />
            <h3 className="text-sm font-semibold text-ink">
              Assign / Reassign Case #{caseRecord.case_id}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl border border-gold/15 bg-canvas/60 p-3 text-xs leading-relaxed text-muted space-y-1">
            <p className="font-semibold text-gold-light">
              Assignment Workflow Notice
            </p>
            <p>
              Assigning case for ring <strong className="font-mono text-ink">{caseRecord.ring_id}</strong> updates the <code className="font-mono text-[11px] text-gold-light">assigned_to</code> property and records a verifiable assignment entry in the compliance log.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Select Primary Investigator
            </label>
            <select
              value={selectedAnalyst}
              onChange={(e) => setSelectedAnalyst(e.target.value)}
              className="w-full rounded-xl border border-gold/20 bg-canvas px-3 py-2 text-xs text-ink focus:border-gold/60 focus:outline-none cursor-pointer"
            >
              {ANALYST_CHOICES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gold/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl border border-gold/40 bg-gold/20 px-4 py-1.5 text-xs font-semibold text-gold-light hover:bg-gold/30 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Updating...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
