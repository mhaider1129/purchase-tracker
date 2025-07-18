import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const ProcurementPlansPage = () => {
  const { user } = useCurrentUser();
  const [plans, setPlans] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPlans = async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/procurement-plans', {
        params: { department_id: user.department_id },
      });
      setPlans(res.data || []);
    } catch (err) {
      console.error('Failed to load plans', err);
    }
  };

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Select a file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('plan', file);
    formData.append('plan_year', year);
    formData.append('department_id', user.department_id);
    try {
      setLoading(true);
      await api.post('/api/procurement-plans', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      fetchPlans();
    } catch (err) {
      console.error('Upload failed', err);
      alert('Failed to upload plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Procurement Plans</h1>
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label className="block font-semibold mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border p-2 w-full"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Upload File</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </form>

        <h2 className="text-xl font-semibold mb-2">Existing Plans</h2>
        <ul className="space-y-2">
          {plans.map((p) => (
            <li key={p.id} className="border p-2 flex justify-between">
              <span>
                {p.plan_year} - {p.file_name}
              </span>
              <a
                href={`/${p.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default ProcurementPlansPage;