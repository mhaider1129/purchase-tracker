import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import {
  getPendingCustodyApprovals,
  submitCustodyDecision,
} from '../../api/custody';
import { Button } from '../../components/ui/Button';

const CustodyApprovals = () => {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ type: 'idle', message: '' });
  const [actionState, setActionState] = useState({ id: null, decision: null });

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getPendingCustodyApprovals();
      setRecords(data);
    } catch (err) {
      console.error('❌ Failed to fetch custody approvals:', err);
      setError('Failed to load custody approvals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleDecision = async (recordId, decision) => {
    const confirmation = window.confirm(
      `Are you sure you want to ${decision} custody record #${recordId}?`,
    );
    if (!confirmation) return;

    setActionState({ id: recordId, decision });
    setBanner({ type: 'idle', message: '' });

    try {
      await submitCustodyDecision(recordId, decision);
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
      setBanner({ type: 'success', message: `Custody record ${decision} successfully.` });
    } catch (err) {
      console.error('❌ Failed to update custody record:', err);
      const message = err.response?.data?.message || 'Failed to submit decision.';
      setBanner({ type: 'error', message });
    } finally {
      setActionState({ id: null, decision: null });
    }
  };

  const renderEmptyState = () => (
    <div className="text-center text-gray-500 py-10 border border-dashed rounded">
      No custody approvals pending your action.
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Custody Approvals</h1>
          <Button variant="secondary" onClick={loadRecords} disabled={isLoading}>
            Refresh
          </Button>
        </div>

        {banner.type !== 'idle' && (
          <div
            className={`mb-4 rounded px-3 py-2 text-sm ${
              banner.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {banner.message}
          </div>
        )}

        {error && <div className="text-red-600 mb-4">{error}</div>}

        {isLoading ? (
          <div className="text-gray-500">Loading custody approvals...</div>
        ) : records.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-4">
            {records.map((record) => {
              const actingRole = record.pending_role === 'hod' ? 'Head of Department' : 'Custodian';
              return (
                <div key={record.id} className="bg-white shadow rounded-lg p-5 border">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">{record.item_name}</h2>
                      <p className="text-sm text-gray-500">
                        Custody Type: {record.custody_type}
                      </p>
                      {record.custody_code && (
                        <p className="text-sm text-gray-500">Code: {record.custody_code}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        Issued by: {record.issued_by_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Created on: {new Date(record.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm font-medium text-indigo-600">
                        Awaiting your action as {actingRole}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold">Quantity:</span> {record.quantity}
                    </div>
                    <div>
                      <span className="font-semibold">Department:</span>{' '}
                      {record.custodian_department_name || 'Not specified'}
                    </div>
                    <div>
                      <span className="font-semibold">Custodian:</span>{' '}
                      {record.custodian_name || 'Department custody'}
                    </div>
                    <div>
                      <span className="font-semibold">HOD:</span>{' '}
                      {record.hod_name || 'Not assigned'}
                    </div>
                  </div>

                  {record.description && (
                    <p className="mt-4 text-sm text-gray-700 border-t pt-3">
                      {record.description}
                    </p>
                  )}

                  <div className="mt-4 flex gap-3 flex-wrap">
                    <Button
                      onClick={() => handleDecision(record.id, 'approved')}
                      disabled={actionState.id === record.id}
                    >
                      {actionState.id === record.id && actionState.decision === 'approved'
                        ? 'Approving...'
                        : 'Approve'}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDecision(record.id, 'rejected')}
                      disabled={actionState.id === record.id}
                    >
                      {actionState.id === record.id && actionState.decision === 'rejected'
                        ? 'Rejecting...'
                        : 'Reject'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustodyApprovals;