import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Edit3, FileCheck2, RotateCcw } from 'lucide-react';
import { contractSectionCatalog, defaultContractApprovalRules } from '../config/contractApprovalRules';

const ROLE_LABELS = {
  contract_manager: 'Contract Manager',
  scm: 'SCM',
  coo: 'COO',
};

const ContractApprovalsPanel = () => {
  const [rules] = useState(() => {
    const saved = localStorage.getItem('contract-approval-rules');
    if (!saved) return defaultContractApprovalRules;
    try {
      return JSON.parse(saved);
    } catch {
      return defaultContractApprovalRules;
    }
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [draftRoundsCompleted, setDraftRoundsCompleted] = useState(0);
  const [isFinalCycle, setIsFinalCycle] = useState(false);
  const [isApprovedForSignature, setIsApprovedForSignature] = useState(false);
  const [selectedSection, setSelectedSection] = useState(contractSectionCatalog[0]);
  const [suggestedText, setSuggestedText] = useState('');
  const [suggestedEdits, setSuggestedEdits] = useState([]);

  const approvalFlow = rules.stages;
  const currentStep = approvalFlow[currentStepIndex];

  const allEditsApproved = useMemo(
    () =>
      suggestedEdits.every((edit) =>
        rules.editGateRoles.every((gateRole) => edit.approvedBy[gateRole]),
      ),
    [rules.editGateRoles, suggestedEdits],
  );

  const handleSuggestEdit = () => {
    if (!suggestedText.trim() || isFinalCycle || isApprovedForSignature) return;

    setSuggestedEdits((prev) => [
      ...prev,
      {
        id: Date.now(),
        stage: currentStep.label,
        section: selectedSection,
        suggestion: suggestedText.trim(),
        approvedBy: rules.editGateRoles.reduce((acc, role) => ({ ...acc, [role]: false }), {}),
      },
    ]);
    setSuggestedText('');
  };

  const toggleEditApproval = (editId, role) => {
    setSuggestedEdits((prev) =>
      prev.map((edit) =>
        edit.id === editId
          ? {
              ...edit,
              approvedBy: {
                ...edit.approvedBy,
                [role]: !edit.approvedBy[role],
              },
            }
          : edit,
      ),
    );
  };

  const moveNext = () => {
    if (currentStepIndex < approvalFlow.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      return;
    }

    if (!isFinalCycle) {
      const hasEditsInDraft = suggestedEdits.length > 0;
      const shouldMoveToFinal =
        draftRoundsCompleted + 1 >= rules.maxDraftEditRounds || !hasEditsInDraft;

      if (hasEditsInDraft && !allEditsApproved) {
        return;
      }

      if (shouldMoveToFinal) {
        setIsFinalCycle(true);
      } else {
        setDraftRoundsCompleted((prev) => prev + 1);
      }

      setCurrentStepIndex(0);
      setSuggestedEdits([]);
      return;
    }

    setIsApprovedForSignature(true);
  };

  const resetWorkflow = () => {
    setCurrentStepIndex(0);
    setDraftRoundsCompleted(0);
    setIsFinalCycle(false);
    setIsApprovedForSignature(false);
    setSuggestedText('');
    setSuggestedEdits([]);
  };


  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link to="/contracts" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to contracts
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Contract Approval Panel</h1>
          <p className="mt-1 text-sm text-slate-600">Rules are configured in frontend settings and can be changed without backend hardcoding.</p>
        </div>
        <button type="button" onClick={resetWorkflow} className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset cycle
        </button>
      </div>

      <div className="mb-4 rounded-lg border bg-white p-4 text-sm text-slate-600">
        <p>Current phase: <span className="font-semibold text-slate-900">{isFinalCycle ? 'Final Approval (No Edits Allowed)' : 'Draft Approval (Edits Enabled)'}</span></p>
        <p>Draft rounds completed: <span className="font-semibold text-slate-900">{draftRoundsCompleted} / {rules.maxDraftEditRounds}</span></p>
      </div>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Approval stages and edit-gate roles are configured from <strong>Management → Contract Approval Rules</strong>.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 lg:col-span-1">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Approval Flow</h2>
          <ol className="space-y-3">
            {approvalFlow.map((step, idx) => (
              <li key={step.key} className={`rounded-md border p-3 ${idx === currentStepIndex ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{step.label}</p>
                  {idx < currentStepIndex && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                </div>
                {step.description && <p className="mt-1 text-xs text-slate-600">{step.description}</p>}
              </li>
            ))}
          </ol>
          <button type="button" onClick={moveNext} disabled={isApprovedForSignature} className="mt-4 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {isApprovedForSignature ? 'Approved for signature' : `Approve ${currentStep.label}`}
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Section Visibility & Suggested Edits</h2>
          <p className="mb-3 text-sm text-slate-600">All approvers can review every contract section and suggest edits in draft phase.</p>

          {!isFinalCycle && !isApprovedForSignature && currentStep?.canSuggestEdits && (
            <div className="mb-4 rounded-md border border-slate-200 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {contractSectionCatalog.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
                <button type="button" onClick={handleSuggestEdit} className="inline-flex items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600">
                  <Edit3 className="mr-2 h-4 w-4" /> Suggest edit
                </button>
              </div>
              <textarea value={suggestedText} onChange={(e) => setSuggestedText(e.target.value)} rows={3} placeholder="Write a section edit suggestion..." className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          )}

          <div className="space-y-3">
            {suggestedEdits.length === 0 ? (
              <p className="text-sm text-slate-500">No edits suggested in this round.</p>
            ) : (
              suggestedEdits.map((edit) => (
                <div key={edit.id} className="rounded-md border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{edit.section} · {edit.stage}</p>
                  <p className="mt-1 text-sm text-slate-700">{edit.suggestion}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {rules.editGateRoles.map((role) => (
                      <button key={role} type="button" onClick={() => toggleEditApproval(edit.id, role)} className={`rounded-full px-3 py-1 ${edit.approvedBy[role] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {ROLE_LABELS[role] || role}: {edit.approvedBy[role] ? 'Approved' : 'Pending'}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {isApprovedForSignature && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <p className="flex items-center font-semibold"><FileCheck2 className="mr-2 h-5 w-5" /> Approved version is now ready for signature.</p>
              <p className="mt-1 text-sm">COO can now sign from Contracts page, then the other party can apply digital written signature.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractApprovalsPanel;