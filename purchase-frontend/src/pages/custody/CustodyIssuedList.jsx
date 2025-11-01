import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Navbar';
import { getIssuedCustodies } from '../../api/custody';
import { Button } from '../../components/ui/Button';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'];

const statusBadgeClasses = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  default: 'bg-gray-100 text-gray-700 border-gray-200',
};

const approvalBadgeClasses = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  notrequired: 'bg-gray-100 text-gray-600 border-gray-200',
  default: 'bg-gray-100 text-gray-600 border-gray-200',
};

const normalizeStatusKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, '');

const CustodyIssuedList = () => {
  const { t } = useTranslation();
  const tr = (key, options) => t(`custodyIssuedPage.${key}`, options);

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadRecords = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getIssuedCustodies();
      setRecords(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('❌ Failed to fetch issued custodies:', err);
      setError(tr('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleStatusChange = (value) => setStatusFilter(value);

  const filteredRecords = useMemo(() => {
    const normalizedStatus = statusFilter.toLowerCase();
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const recordStatus = normalizeStatusKey(record.status);
      const matchesStatus =
        normalizedStatus === 'all' || recordStatus === normalizedStatus;

      if (!normalizedSearch) {
        return matchesStatus;
      }

      const haystack = [
        record.item_name,
        record.custodian_name,
        record.custodian_department_name,
        record.custody_code,
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      const matchesSearch = haystack.some((value) => value.includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [records, statusFilter, searchTerm]);

  const getStatusBadge = (status) => {
    const key = normalizeStatusKey(status);
    return statusBadgeClasses[key] || statusBadgeClasses.default;
  };

  const getApprovalBadge = (status) => {
    const key = normalizeStatusKey(status);
    return approvalBadgeClasses[key] || approvalBadgeClasses.default;
  };

  const formatStatusLabel = (status) => {
    const key = normalizeStatusKey(status) || 'unknown';
    return tr(`statusLabels.${key}`, { defaultValue: status || tr('statusLabels.unknown') });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('pageTitles.custodyIssued')}</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-1">
                {tr('lastUpdated', { time: lastUpdated.toLocaleString() })}
              </p>
            )}
          </div>
          <Button variant="secondary" onClick={loadRecords} disabled={isLoading}>
            {tr('actions.refresh')}
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
          <div className="w-full lg:max-w-sm">
            <label htmlFor="custody-issued-search" className="sr-only">
              {tr('filters.searchLabel')}
            </label>
            <input
              id="custody-issued-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={tr('filters.searchPlaceholder')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {tr('filters.status.label')}
            </span>
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => handleStatusChange(filter)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {tr(`filters.status.${filter}`)}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="text-gray-500">{tr('loading')}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-gray-500">
            {tr(searchTerm || statusFilter !== 'all' ? 'emptyStateFiltered' : 'emptyState')}
          </div>
        ) : (
          <div className="space-y-5">
            {filteredRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{record.item_name}</h2>
                    <p className="text-sm text-gray-500">
                      {tr('fields.custodyType', { type: record.custody_type })}
                    </p>
                    {record.custody_code && (
                      <p className="text-sm text-gray-500">
                        {tr('fields.code', { code: record.custody_code })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 text-sm text-gray-600 md:items-end">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadge(record.status)}`}
                    >
                      {formatStatusLabel(record.status)}
                    </span>
                    <p>{tr('fields.issuedBy', { name: record.issued_by_name || tr('fields.unknown') })}</p>
                    <p>
                      {tr('fields.createdOn', {
                        date: record.created_at
                          ? new Date(record.created_at).toLocaleString()
                          : tr('fields.unknown'),
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-gray-700 md:grid-cols-2">
                  <div>
                    <span className="font-semibold">{tr('fields.quantity')}</span> {record.quantity}
                  </div>
                  <div>
                    <span className="font-semibold">{tr('fields.custodian')}</span>{' '}
                    {record.custodian_name || tr('fields.departmentCustody')}
                  </div>
                  <div>
                    <span className="font-semibold">{tr('fields.department')}</span>{' '}
                    {record.custodian_department_name || tr('fields.notSpecified')}
                  </div>
                  <div>
                    <span className="font-semibold">{tr('fields.hod')}</span>{' '}
                    {record.hod_name || tr('fields.notAssigned')}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div
                    className={`rounded-md border px-3 py-2 shadow-sm ${getApprovalBadge(record.user_approval_status)}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {tr('fields.custodianApproval')}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatStatusLabel(record.user_approval_status)}
                    </p>
                  </div>
                  <div
                    className={`rounded-md border px-3 py-2 shadow-sm ${getApprovalBadge(record.hod_approval_status)}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {tr('fields.hodApproval')}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatStatusLabel(record.hod_approval_status)}
                    </p>
                  </div>
                </div>

                {record.description && (
                  <p className="mt-4 border-t border-dashed pt-3 text-sm text-gray-700">
                    {record.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustodyIssuedList;