import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileSearch,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCircle2,
  XCircle,
} from 'lucide-react';
import api from '../api/axios';

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (normalized === 'rejected') return 'bg-rose-100 text-rose-700 ring-rose-200';
  if (normalized === 'returned') return 'bg-amber-100 text-amber-700 ring-amber-200';
  if (normalized === 'pending') return 'bg-blue-100 text-blue-700 ring-blue-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

const activeClass = (isActive) =>
  isActive
    ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
    : 'bg-slate-100 text-slate-600 ring-slate-200';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const StageStatusIcon = ({ status, isActive }) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (normalized === 'rejected') return <XCircle className="h-5 w-5 text-rose-600" />;
  if (normalized === 'returned') return <AlertCircle className="h-5 w-5 text-amber-600" />;
  if (isActive) return <Clock3 className="h-5 w-5 text-indigo-600" />;
  return <Clock3 className="h-5 w-5 text-slate-400" />;
};

const getAssignedLabel = (stage) => {
  if (stage.reviewer_name) {
    return `${stage.reviewer_name}${stage.reviewer_email ? ` · ${stage.reviewer_email}` : ''}`;
  }
  return `Unassigned ${stage.reviewer_role || 'reviewer'} role queue`;
};

const ContractApprovalStageMonitor = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeOnly, setActiveOnly] = useState(false);

  const fetchMonitor = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/contracts/approval-stage-monitor');
      setContracts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch SCM contract approval stage monitor', err);
      setContracts([]);
      setError(err?.response?.data?.message || 'Unable to load contract approval stages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitor();
  }, []);

  const stats = useMemo(() => {
    const allStages = contracts.flatMap((contract) => contract.stages || []);
    return {
      contracts: contracts.length,
      stages: allStages.length,
      active: allStages.filter((stage) => stage.is_active).length,
      pending: allStages.filter((stage) => String(stage.stage_status).toLowerCase() === 'pending').length,
    };
  }, [contracts]);

  const statusOptions = useMemo(() => {
    const values = new Set();
    contracts.forEach((contract) => {
      (contract.stages || []).forEach((stage) => {
        if (stage.stage_status) values.add(stage.stage_status);
      });
    });
    return ['all', ...Array.from(values).sort()];
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contracts
      .map((contract) => {
        const contractText = [
          contract.contract_title,
          contract.vendor,
          contract.reference_number,
          contract.contract_status,
          contract.contract_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const originalStages = contract.stages || [];
        const stages = originalStages.filter((stage) => {
          const stageText = [
            stage.stage,
            stage.reviewer_role,
            stage.reviewer_name,
            stage.reviewer_email,
            stage.stage_status,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const matchesQuery = !normalizedQuery || contractText.includes(normalizedQuery) || stageText.includes(normalizedQuery);
          const matchesStatus = statusFilter === 'all' || stage.stage_status === statusFilter;
          const matchesActive = !activeOnly || stage.is_active;
          return matchesQuery && matchesStatus && matchesActive;
        });

        const keepContract = stages.length > 0 || (
          originalStages.length === 0 &&
          !activeOnly &&
          statusFilter === 'all' &&
          (!normalizedQuery || contractText.includes(normalizedQuery))
        );
        return keepContract ? { ...contract, stages } : null;
      })
      .filter(Boolean);
  }, [activeOnly, contracts, query, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/contracts" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to contracts
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">SCM Contract Approval Stage Monitor</h1>
              <p className="mt-1 text-sm text-slate-600">
                SCM-only oversight panel showing every contract approval stage, assigned user or role queue, status, activity, and timing.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchMonitor}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh stages
        </button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monitored contracts</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.contracts}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval stages</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.stages}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active stages</p>
          <p className="mt-2 text-3xl font-bold text-indigo-700">{stats.active}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending stages</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">{stats.pending}</p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by contract, vendor, stage, role, user, email, or status"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option === 'all' ? 'All stage statuses' : option}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setActiveOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Active stage only
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">Loading approval stage monitor...</div>
      ) : filteredContracts.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <FileSearch className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700">No contract approval stages match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredContracts.map((contract) => (
            <section key={contract.contract_id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      #{contract.contract_id} · {contract.contract_title || 'Untitled Contract'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {contract.vendor || 'No vendor recorded'}{contract.reference_number ? ` · Ref ${contract.reference_number}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Contract status: {contract.contract_status || '—'} · Updated {formatDateTime(contract.contract_updated_at)}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold text-indigo-700">Active:</span>{' '}
                    {contract.active_stage ? `${contract.active_stage.stage} (${contract.active_stage.reviewer_role || 'role queue'})` : 'No active stage'}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {contract.stages.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-slate-600 sm:px-5">
                    No approval workflow has been submitted for this contract yet.
                  </div>
                ) : contract.stages.map((stage) => (
                  <div key={stage.approval_id} className={`grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(180px,260px)_1fr_minmax(190px,240px)] ${stage.is_active ? 'bg-indigo-50/60' : 'bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <StageStatusIcon status={stage.stage_status} isActive={stage.is_active} />
                      <div>
                        <p className="font-semibold text-slate-900">L{stage.approval_level} · {stage.stage}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Reviewer role: {stage.reviewer_role || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-slate-700">
                      <UserCircle2 className="mt-0.5 h-5 w-5 flex-none text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{getAssignedLabel(stage)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          User role: {stage.reviewer_user_role || 'Not assigned to a named user yet'} · Assigned {formatDateTime(stage.assigned_at)}
                        </p>
                        {stage.comments && <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{stage.comments}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(stage.stage_status)}`}>{stage.stage_status || 'Unknown'}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${activeClass(stage.is_active)}`}>{stage.is_active ? 'Active now' : 'Inactive'}</span>
                      <span className="w-full text-xs text-slate-500 lg:text-right">Decided {formatDateTime(stage.decided_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractApprovalStageMonitor;