// src/pages/RequestSubmittedPage.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/Button';

const RequestSubmittedPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const requestType = location.state?.requestType || 'Purchase';

  return (
    <>
      <Navbar />
      <main className="flex flex-col items-center justify-center h-[80vh] px-4 text-center">
        <section>
          <h1 className="text-3xl font-bold text-green-700 mb-4">
            ✅ {requestType} Request Submitted Successfully!
          </h1>
          <p className="text-gray-600 mb-6 max-w-md">
            Your request has been submitted and is now pending approval.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={() => navigate('/open-requests')}
              variant="primary"
              ariaLabel="View Open Requests"
            >
              View Open Requests
            </Button>

            <Button
              onClick={() => navigate('/')}
              variant="secondary"
              ariaLabel="Back to Home"
            >
              Back to Home
            </Button>

            <Button
              onClick={() => navigate('/request-type')}
              variant="outline"
              ariaLabel="Submit Another Request"
            >
              Submit Another Request
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

export default RequestSubmittedPage;