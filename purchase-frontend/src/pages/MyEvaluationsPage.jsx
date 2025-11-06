import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const MyEvaluationsPage = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvaluations = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/api/contract-evaluations/my-evaluations');
        setEvaluations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load evaluations', err);
        setError('Unable to load evaluations.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvaluations();
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Evaluations</h1>
        </header>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {evaluations.length > 0 ? (
          <ul className="space-y-4">
            {evaluations.map((evaluation) => (
              <li key={evaluation.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <a href={`/evaluations/${evaluation.id}`} className="hover:underline">
                  <h2 className="text-xl font-semibold">{evaluation.contract_title}</h2>
                  <p>Status: {evaluation.status}</p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>You have no evaluations assigned.</p>
        )}
      </main>
    </>
  );
};

export default MyEvaluationsPage;