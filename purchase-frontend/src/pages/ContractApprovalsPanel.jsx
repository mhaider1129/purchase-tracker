import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, FileText, XCircle } from 'lucide-react';
import api from '../api/axios';

const DECISION_BUTTONS = [
  { value: 'Approved', label: 'Approve', className: 'bg-emerald-600 hover:bg-emerald-700' },
  { value: 'Returned', label: 'Return', className: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'Rejected', label: 'Reject', className: 'bg-rose-600 hover:bg-rose-700' },
];

const badgeClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'rejected') return 'bg-rose-100 text-rose-700';
  if (normalized === 'returned') return 'bg-amber-100 text-amber-700';
  if (normalized === 'pending') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
};

const ContractApprovalsPanel = () => {
  const [pendingContracts, setPendingContracts] = useState([]);
  const [approvalsByContract, setApprovalsByContract] = useState({});
  const [decisionComments, setDecisionComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [actingApprovalId, setActingApprovalId] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contracts/pending-approvals');
      setPendingContracts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch contract pending approvals', err);
      setPendingContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const loadContractApprovals = async (contractId) => {
    if (approvalsByContract[contractId]) return;
    try {
      const { data } = await api.get(`/contracts/${contractId}/approvals`);
      setApprovalsByContract((prev) => ({ ...prev, [contractId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error('Failed to fetch contract approvals', err);
    }
  };

  const handleDecision = async ({ contractId, approvalId, decision }) => {
    setActingApprovalId(approvalId);
    try {
      await api.post(`/contracts/${contractId}/approvals/${approvalId}/decision`, {
        decision,
        comments: decisionComments[approvalId] || null,
      });
      setApprovalsByContract((prev) => {
        if (!prev[contractId]) return prev;
        return { ...prev, [contractId]: prev[contractId].map((step) => (step.id === approvalId ? { ...step, status: decision, is_active: false } : step)) };
      });
      await fetchPending();
      await loadContractApprovals(contractId);
    } catch (err) {
      console.error('Failed to submit approval decision', err);
      window.alert(err?.response?.data?.message || 'Unable to save your decision.');
    } finally {
      setActingApprovalId(null);
    }
  };

  const summaryText = useMemo(() => {
    if (loading) return 'Loading your pending contract approvals...';
    if (pendingContracts.length === 0) return 'No contract approvals are currently assigned to your account.';
    return `${pendingContracts.length} contract${pendingContracts.length > 1 ? 's are' : ' is'} awaiting your action.`;
  }, [loading, pendingContracts.length]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <Link to="/contracts" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to contracts
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Contract Approval Inbox</h1>
        <p className="mt-1 text-sm text-slate-600">Each submitted draft contract appears here for assigned approvers. Approvals are tied to your account.</p>
      </div>

      <div className="mb-4 rounded-lg border bg-white p-4 text-sm text-slate-600">{summaryText}</div>

      <div className="space-y-4">
        {pendingContracts.map((contract) => (
          <div key={contract.contract_id} className="rounded-lg border bg-white p-4">
            <button
              type="button"
              onClick={() => loadContractApprovals(contract.contract_id)}
              className="flex w-full items-start justify-between gap-2 text-left"
            >
              <div>
                <p className="text-base font-semibold text-slate-900">#{contract.contract_id} · {contract.contract_title || 'Untitled Contract'}</p>
                <p className="mt-1 text-sm text-slate-600">Current step: {contract.stage} ({contract.reviewer_role})</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">Pending your decision</span>
            </button>

            <div className="mt-3 rounded-md border border-slate-200 p-3">
              <textarea
                value={decisionComments[contract.approval_id] || ''}
                onChange={(e) => setDecisionComments((prev) => ({ ...prev, [contract.approval_id]: e.target.value }))}
                rows={2}
                placeholder="Add optional comments for your decision"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {DECISION_BUTTONS.map((btn) => (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => handleDecision({ contractId: contract.contract_id, approvalId: contract.approval_id, decision: btn.value })}
                    disabled={actingApprovalId === contract.approval_id}
                    className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${btn.className}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {approvalsByContract[contract.contract_id] && (
              <div className="mt-3 space-y-2">
                {approvalsByContract[contract.contract_id].map((step) => (
                  <div key={step.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      {step.status === 'Approved' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : step.status === 'Rejected' ? <XCircle className="h-4 w-4 text-rose-600" /> : step.status === 'Returned' ? <FileText className="h-4 w-4 text-amber-600" /> : <Clock3 className="h-4 w-4 text-blue-600" />}
                      <span>L{step.approval_level} {step.stage}</span>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(step.status)}`}>{step.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractApprovalsPanel;