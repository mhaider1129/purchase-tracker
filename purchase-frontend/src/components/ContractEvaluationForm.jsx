import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const ContractEvaluationForm = ({ contractId, onClose }) => {
  const [users, setUsers] = useState([]);
  const [evaluatorId, setEvaluatorId] = useState('');
  const [criteria, setCriteria] = useState([{ name: '', score: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get('/api/users');
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load users', err);
        setError('Unable to load users.');
      }
    };
    fetchUsers();
  }, []);

  const handleCriteriaChange = (index, event) => {
    const values = [...criteria];
    values[index][event.target.name] = event.target.value;
    setCriteria(values);
  };

  const handleAddCriteria = () => {
    setCriteria([...criteria, { name: '', score: '' }]);
  };

  const handleRemoveCriteria = (index) => {
    const values = [...criteria];
    values.splice(index, 1);
    setCriteria(values);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!evaluatorId) {
      setError('Please select an evaluator.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/api/contract-evaluations', {
        contract_id: contractId,
        evaluator_id: evaluatorId,
        evaluation_criteria: criteria,
      });
      onClose();
    } catch (err) {
      console.error('Failed to send for evaluation', err);
      setError(err?.response?.data?.message || 'Failed to send for evaluation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Send for Evaluation</h3>
          <div className="mt-2 px-7 py-3">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="evaluator" className="block text-sm font-medium text-gray-700">
                  Evaluator
                </label>
                <select
                  id="evaluator"
                  name="evaluator"
                  value={evaluatorId}
                  onChange={(e) => setEvaluatorId(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select an evaluator</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              {criteria.map((criterion, index) => (
                <div key={index} className="mb-4">
                  <label htmlFor={`name-${index}`} className="block text-sm font-medium text-gray-700">
                    Criterion Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id={`name-${index}`}
                    value={criterion.name}
                    onChange={(event) => handleCriteriaChange(index, event)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <button type="button" onClick={() => handleRemoveCriteria(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddCriteria()}>
                Add Criterion
              </button>
              {error && <p className="text-red-500 text-xs italic">{error}</p>}
              <div className="items-center px-4 py-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {saving ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
          <div className="items-center px-4 py-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractEvaluationForm;