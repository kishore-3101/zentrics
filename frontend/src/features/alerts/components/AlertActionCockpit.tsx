import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle, FileText, Lock, MessageSquare, Send, X } from 'lucide-react';
import type { AlertRecord } from '../../../types/alerts';
import type { CaseActionPayload } from '../../../services/alerts.service';

interface AlertActionCockpitProps {
  alert: AlertRecord;
  onPerformAction: (payload: CaseActionPayload) => Promise<void>;
  isSubmitting: boolean;
}

export function AlertActionCockpit({
  alert,
  onPerformAction,
  isSubmitting,
}: AlertActionCockpitProps) {
  const [activeModal, setActiveModal] = useState<
    'none' | 'escalate' | 'freeze' | 'false_positive' | 'note'
  >('none');
  const [noteText, setNoteText] = useState('');
  const [fpReason, setFpReason] = useState('Legitimate Merchant Pooling');
  const [escalateSupervisor, setEscalateSupervisor] = useState('P. Sharma (Senior AML Lead)');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleQuickInvestigate = async () => {
    setActionNotice('Demo Simulation: Case assigned to investigator. Status set to Under Review.');
    await onPerformAction({
      action: 'status_change',
      to_status: 'under_review',
      note: 'Analyst opened case for investigation.',
      actor: 'Lead AML Investigator',
    });
  };

  const handleEscalateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setActionNotice(`Demo Simulation: Case escalated to ${escalateSupervisor}.`);
    await onPerformAction({
      action: 'escalate',
      to_status: 'escalated',
      actor: 'Lead AML Investigator',
      note: noteText
        ? `Escalated to ${escalateSupervisor}: ${noteText}`
        : `Escalated to ${escalateSupervisor} for priority intervention.`,
    });
    setNoteText('');
    setActiveModal('none');
  };

  const handleFreezeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setActionNotice(
      `Demo Simulation: Simulated debit/credit freeze placed on collector and mule nodes in ring ${alert.ring_id}. Victim accounts spared. (No real banking entities touched).`,
    );
    await onPerformAction({
      action: 'freeze',
      to_status: 'frozen',
      actor: 'Senior AML Operations',
      note: noteText
        ? `Simulated freeze executed: ${noteText}`
        : `Simulated precautionary freeze on ${alert.n_accounts - alert.n_victims} non-victim ring accounts.`,
    });
    setNoteText('');
    setActiveModal('none');
  };

  const handleFalsePositiveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setActionNotice(`Demo Simulation: Case resolved as False Positive (${fpReason}).`);
    await onPerformAction({
      action: 'false_positive',
      to_status: 'false_positive',
      actor: 'Lead AML Investigator',
      note: `Resolved as False Positive [${fpReason}]: ${noteText || 'Documentation verified and cleared.'}`,
    });
    setNoteText('');
    setActiveModal('none');
  };

  const handleAddNoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setActionNotice('Case note recorded into immutable audit trail.');
    await onPerformAction({
      action: 'note',
      actor: 'Lead AML Investigator',
      note: noteText.trim(),
    });
    setNoteText('');
    setActiveModal('none');
  };

  return (
    <div className="space-y-3 rounded-2xl border border-gold/20 bg-card/70 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Analyst Decision Cockpit
        </h4>
        <span className="rounded bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold-light border border-gold/20">
          DEMO SIMULATION
        </span>
      </div>

      {actionNotice && (
        <div className="rounded-lg border border-emerald/30 bg-emerald/10 p-2.5 text-xs text-emerald flex items-start justify-between gap-2">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-emerald hover:text-emerald-light shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Mark Investigating (only if new) */}
        <button
          type="button"
          disabled={isSubmitting || alert.status === 'under_review'}
          onClick={handleQuickInvestigate}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
            alert.status === 'under_review'
              ? 'border-gold/30 bg-gold/15 text-gold-light cursor-default'
              : 'border-gold/25 bg-gold/10 text-gold-light hover:bg-gold/20'
          }`}
        >
          <FileText className="size-3.5" />
          {alert.status === 'under_review' ? 'In Review' : 'Investigate'}
        </button>

        {/* Escalate */}
        <button
          type="button"
          disabled={isSubmitting || alert.status === 'escalated'}
          onClick={() => setActiveModal('escalate')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
            alert.status === 'escalated'
              ? 'border-danger/30 bg-danger/15 text-danger cursor-default'
              : 'border-danger/25 bg-danger/10 text-danger hover:bg-danger/20'
          }`}
        >
          <AlertTriangle className="size-3.5" />
          Escalate
        </button>

        {/* Simulate Freeze Accounts */}
        <button
          type="button"
          disabled={isSubmitting || alert.status === 'frozen'}
          onClick={() => setActiveModal('freeze')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
            alert.status === 'frozen'
              ? 'border-emerald/30 bg-emerald/15 text-emerald cursor-default'
              : 'border-emerald/30 bg-emerald/10 text-emerald hover:bg-emerald/20'
          }`}
        >
          <Lock className="size-3.5" />
          {alert.status === 'frozen' ? 'Frozen' : 'Simulate Freeze'}
        </button>

        {/* Mark False Positive */}
        <button
          type="button"
          disabled={isSubmitting || alert.status === 'false_positive'}
          onClick={() => setActiveModal('false_positive')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
            alert.status === 'false_positive'
              ? 'border-muted/30 bg-muted/15 text-muted cursor-default'
              : 'border-muted/25 bg-canvas/60 text-ink/80 hover:bg-canvas'
          }`}
        >
          <CheckCircle className="size-3.5" />
          {alert.status === 'false_positive' ? 'False Positive' : 'Resolve (FP)'}
        </button>
      </div>

      {/* Add Note Button / Quick Bar */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setActiveModal('note')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/20 bg-canvas/50 px-3 py-2 text-xs font-medium text-muted hover:border-gold/40 hover:text-ink transition-colors"
        >
          <MessageSquare className="size-3.5 text-gold" />
          Log Analyst Hypothesis or Investigation Note
        </button>
      </div>

      {/* Modal Dialogs */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gold/25 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gold/10 pb-3">
              <h3 className="text-sm font-semibold text-ink">
                {activeModal === 'escalate' && 'Escalate Alert to Senior AML'}
                {activeModal === 'freeze' && 'Simulate Debit/Credit Account Freezes'}
                {activeModal === 'false_positive' && 'Resolve Alert as False Positive'}
                {activeModal === 'note' && 'Add Case Investigation Note'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Escalate Form */}
            {activeModal === 'escalate' && (
              <form onSubmit={handleEscalateSubmit} className="mt-4 space-y-3">
                <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-warning leading-relaxed">
                  Escalating flags this ring for high-priority review and notifies the Senior AML officer.
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Assignee Supervisor
                  </label>
                  <select
                    value={escalateSupervisor}
                    onChange={(e) => setEscalateSupervisor(e.target.value)}
                    className="w-full rounded-xl border border-gold/20 bg-canvas px-3 py-2 text-xs text-ink focus:border-gold"
                  >
                    <option value="P. Sharma (Senior AML Lead)">P. Sharma (Senior AML Lead)</option>
                    <option value="V. Rajan (Cyber Crime Nodal Officer)">V. Rajan (Cyber Crime Nodal Officer)</option>
                    <option value="R. Iyer (Head of Financial Crime)">R. Iyer (Head of Financial Crime)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Escalation Reason & Notes
                  </label>
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Enter urgent findings, velocity concerns or law enforcement references..."
                    className="w-full rounded-xl border border-gold/20 bg-canvas p-3 text-xs text-ink focus:border-gold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-danger/20 border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger hover:bg-danger/30"
                  >
                    Confirm Escalation
                  </button>
                </div>
              </form>
            )}

            {/* Freeze Form */}
            {activeModal === 'freeze' && (
              <form onSubmit={handleFreezeSubmit} className="mt-4 space-y-3">
                <div className="rounded-lg border border-emerald/30 bg-emerald/10 p-3 text-xs text-ink/90 leading-relaxed space-y-1.5">
                  <p className="font-semibold text-emerald">
                    Demo Simulation: Sparing Legitimate Victims
                  </p>
                  <p className="text-muted">
                    This simulation applies credit/debit freezes to collector and mule accounts in ring{' '}
                    <strong className="text-gold-light">{alert.ring_id}</strong>. The{' '}
                    <strong className="text-emerald">{alert.n_victims} victim accounts</strong> are explicitly protected.
                  </p>
                  <p className="text-[11px] text-muted/70 italic">
                    (Note: Hackathon demo environment; real banking switches are not called).
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Enforcement Audit Note
                  </label>
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Enter freeze authorization ticket number or law enforcement request ID..."
                    className="w-full rounded-xl border border-gold/20 bg-canvas p-3 text-xs text-ink focus:border-gold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-emerald/20 border border-emerald/40 px-4 py-1.5 text-xs font-semibold text-emerald hover:bg-emerald/30"
                  >
                    Execute Simulated Freeze
                  </button>
                </div>
              </form>
            )}

            {/* False Positive Form */}
            {activeModal === 'false_positive' && (
              <form onSubmit={handleFalsePositiveSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Structured Reason
                  </label>
                  <select
                    value={fpReason}
                    onChange={(e) => setFpReason(e.target.value)}
                    className="w-full rounded-xl border border-gold/20 bg-canvas px-3 py-2 text-xs text-ink focus:border-gold"
                  >
                    <option value="Legitimate Merchant Pooling">Legitimate Merchant Pooling</option>
                    <option value="Payroll Disburser / HR Settlement">Payroll Disburser / HR Settlement</option>
                    <option value="Family / Intra-Group Transfers">Family / Intra-Group Transfers</option>
                    <option value="Verified E-Commerce Aggregator">Verified E-Commerce Aggregator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Analyst Justification Notes
                  </label>
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Provide verification details (GST confirmation, invoice audit, customer outreach)..."
                    className="w-full rounded-xl border border-gold/20 bg-canvas p-3 text-xs text-ink focus:border-gold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-gold/20 border border-gold/40 px-4 py-1.5 text-xs font-semibold text-gold-light hover:bg-gold/30"
                  >
                    Resolve as False Positive
                  </button>
                </div>
              </form>
            )}

            {/* Add Note Form */}
            {activeModal === 'note' && (
              <form onSubmit={handleAddNoteSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Investigative Note
                  </label>
                  <textarea
                    rows={4}
                    value={noteText}
                    required
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Log hypotheses, pattern checks, phone record verification, or coordination notes..."
                    className="w-full rounded-xl border border-gold/20 bg-canvas p-3 text-xs text-ink focus:border-gold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !noteText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold/20 border border-gold/40 px-4 py-1.5 text-xs font-semibold text-gold-light hover:bg-gold/30 disabled:opacity-50"
                  >
                    <Send className="size-3" />
                    Record Note
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
