import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const EvaluationDetailsPage = () => {
  const { id } = useParams();
  const [evaluation, setEvaluation] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvaluationDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: evaluationData } = await api.get(`/api/contract-evaluations?id=${id}`);
        setEvaluation(evaluationData);

        const { data: criteriaData } = await api.get('/api/contract-evaluations/criteria');
        setCriteria(criteriaData);
      } catch (err) {
        console.error('Failed to load evaluation details', err);
        setError('Unable to load evaluation details.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvaluationDetails();
  }, [id]);

  const handleScoreChange = (component, score) => {
    setScores({ ...scores, [component]: score });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.patch(`/api/contract-evaluations/${id}`, {
        status: 'completed',
        evaluation_notes: notes,
        evaluation_criteria: JSON.stringify(scores),
      });
      alert('Evaluation submitted successfully!');
    } catch (err) {
      console.error('Failed to submit evaluation', err);
      setError('Unable to submit evaluation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Evaluation Details</h1>
        </header>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {evaluation && (
          <form onSubmit={handleSubmit}>
            {criteria.map((criterion) => (
              <div key={criterion.id} className="mb-4">
                <h2 className="text-xl font-semibold">{criterion.name}</h2>
                {criterion.components.map((component) => (
                  <div key={component} className="ml-4">
                    <label>{component}</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      onChange={(e) => handleScoreChange(component, e.target.value)}
                      className="ml-2 rounded border border-gray-300 p-1"
                    />
                  </div>
                ))}
              </div>
            ))}
            <div className="mt-4">
              <label htmlFor="notes" className="block text-lg font-medium">Evaluation Notes</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-gray-300 p-2"
              />
            </div>
            <button type="submit" className="mt-4 rounded bg-blue-500 px-4 py-2 text-white">
              Submit Evaluation
            </button>
          </form>
        )}
      </main>
    </>
  );
};

export default EvaluationDetailsPage;