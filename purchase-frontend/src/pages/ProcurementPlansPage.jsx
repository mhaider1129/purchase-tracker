import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const ProcurementPlansPage = () => {
  const { user } = useCurrentUser();
  const [plans, setPlans] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  const fetchPlans = useCallback(
    async (options = {}) => {
      if (!user) return;

      const params = {
        department_id: user.department_id,
        ...(options.year && options.year !== 'all' ? { year: options.year } : {}),
      };

      try {
        setIsFetching(true);
        setError('');
        const res = await api.get('/api/procurement-plans', { params });
        setPlans(res.data || []);
      } catch (err) {
        console.error('Failed to load plans', err);
        setError('We were unable to load the procurement plans. Please try again.');
      } finally {
        setIsFetching(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchPlans({ year: filterYear });
  }, [fetchPlans, filterYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Select a file to upload.');
      setSuccess('');
      return;
    }
    const formData = new FormData();
    formData.append('plan', file);
    formData.append('plan_year', year);
    formData.append('department_id', user.department_id);
    try {
      setLoading(true);
      setSuccess('');
      setError('');
      await api.post('/api/procurement-plans', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      setSuccess('Procurement plan uploaded successfully.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchPlans({ year: filterYear });
    } catch (err) {
      console.error('Upload failed', err);
      setError('Failed to upload plan. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set(plans.map((p) => p.plan_year));
    return Array.from(years).sort((a, b) => b - a);
  }, [plans]);

  const filteredPlans = useMemo(() => {
    return plans
      .filter((plan) =>
        filterYear === 'all' ? true : Number(plan.plan_year) === Number(filterYear)
      )
      .filter((plan) =>
        searchTerm
          ? plan.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(plan.plan_year).includes(searchTerm)
          : true
      )
      .sort((a, b) => Number(b.plan_year) - Number(a.plan_year));
  }, [plans, filterYear, searchTerm]);

  const renderStatusMessage = () => {
    if (loading) {
      return 'Uploading procurement plan...';
    }
    if (success) {
      return success;
    }
    if (error) {
      return error;
    }
    return '';
  };

  const statusType = loading ? 'info' : success ? 'success' : error ? 'error' : '';

  const planTable = (
    <div className="overflow-x-auto rounded border border-gray-200 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-gray-200" aria-label="Procurement plans table">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Year
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              File
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Uploaded On
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredPlans.map((plan) => {
            const uploadedOn = plan.created_at
              ? new Date(plan.created_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—';

            return (
              <tr key={plan.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{plan.plan_year}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{plan.file_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{uploadedOn}</td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`/${plan.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    View
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filteredPlans.length === 0 && (
        <div className="px-4 py-6 text-sm text-gray-500 text-center">
          No procurement plans match the selected filters.
        </div>
      )}
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="mx-auto w-full max-w-5xl p-6 space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Procurement Plans</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload and review annual procurement plans for your department. Use the filters to quickly
            find historical plans and confirm compliance.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Upload a plan</h2>
            <p className="mt-1 text-sm text-gray-600">
              Accepted file types include PDF, Excel, and Word documents up to 10MB.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="plan-year">
                  Plan year
                </label>
                <input
                  id="plan-year"
                  type="number"
                  min="2000"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-describedby="plan-year-help"
                  required
                />
                <p id="plan-year-help" className="mt-1 text-xs text-gray-500">
                  Enter the calendar year that this procurement plan covers.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="plan-file">
                  Upload file
                </label>
                <input
                  id="plan-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-600 hover:file:bg-blue-100"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? 'Uploading…' : 'Upload plan'}
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Plan overview</h2>
            <dl className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <dt>Total plans</dt>
                <dd className="font-semibold text-gray-900">{plans.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Most recent year</dt>
                <dd className="font-semibold text-gray-900">
                  {availableYears.length > 0 ? availableYears[0] : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Oldest year</dt>
                <dd className="font-semibold text-gray-900">
                  {availableYears.length > 0 ? availableYears[availableYears.length - 1] : '—'}
                </dd>
              </div>
            </dl>
            <div className="mt-4 text-xs text-gray-500">
              Keep procurement plans up to date to streamline audits and ensure upcoming requests
              align with budget allocations.
            </div>
          </div>
        </section>

        {renderStatusMessage() && (
          <div
            className={`rounded border px-4 py-3 text-sm ${
              statusType === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : statusType === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
            role="status"
            aria-live="polite"
          >
            {renderStatusMessage()}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Existing plans</h2>
              <p className="text-sm text-gray-600">Browse previously uploaded procurement plans.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="flex flex-col text-sm font-medium text-gray-700">
                Filter by year
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All years</option>
                  {availableYears.map((planYear) => (
                    <option key={planYear} value={planYear}>
                      {planYear}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm font-medium text-gray-700">
                Search
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by year or file name"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {isFetching ? (
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
              Loading procurement plans…
            </div>
          ) : (
            planTable
          )}
        </section>
      </div>
    </>
  );
};

export default ProcurementPlansPage;