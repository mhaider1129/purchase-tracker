//src/components/AssignRequestPanel.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import { Button } from './ui/Button';

const AssignRequestPanel = ({ requestId, currentAssignee, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchProcurementUsers = async () => {
      try {
        const res = await axios.get('/api/requests/procurement-users');
        setUsers(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch procurement users:', err);
        setMessage({ type: 'error', text: 'Failed to load users.' });
      }
    };

    fetchProcurementUsers();
  }, []);

  const handleAssign = async () => {
    if (!selectedUser) {
      setMessage({ type: 'error', text: 'Please select a user.' });
      return;
    }

    setLoading(true);
    try {
      await axios.put('/api/requests/assign-procurement', {
        request_id: requestId,
        user_id: selectedUser,
      });
      setMessage({ type: 'success', text: '✅ Request successfully assigned!' });

      setTimeout(() => setMessage(null), 3000); // Auto-dismiss success
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to assign request',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow mt-4">
      <h2 className="text-lg font-semibold mb-3">
        {currentAssignee ? `Reassign Request (currently ${currentAssignee})` : 'Assign to Procurement Staff'}
      </h2>

      <label htmlFor="assign-user" className="sr-only">Select User</label>
      <select
        id="assign-user"
        value={selectedUser}
        onChange={(e) => setSelectedUser(e.target.value)}
        className="border p-2 rounded w-full mb-3"
      >
        <option value="">Select User</option>
        {users.length > 0 ? (
          users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))
        ) : (
          <option disabled>Loading users...</option>
        )}
      </select>

      <Button
        onClick={handleAssign}
        isLoading={loading}
        fullWidth
        disabled={loading || users.length === 0}
      >
        {currentAssignee ? 'Reassign' : 'Assign'}
      </Button>

      {message && (
        <div
          className={`mt-2 text-sm ${
            message.type === 'error' ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};

export default AssignRequestPanel;