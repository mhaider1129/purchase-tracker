// src/pages/RequestSubmittedPage.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

const RequestSubmittedPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const requestType = location.state?.requestType || 'Purchase';

  return (
    <>
      <Navbar />
      <main className="flex flex-col items-center justify-center h-[80vh] px-4 text-center">
        <section>
          <h1 className="text-3xl font-bold text-green-700 mb-4">
            ✅ {t('requestSubmitted.title', { type: requestType })}
          </h1>
          <p className="text-gray-600 mb-6 max-w-md">
            {t('requestSubmitted.pending')}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={() => navigate('/open-requests')}
              variant="primary"
              ariaLabel={t('requestSubmitted.viewOpen')}
            >
              {t('requestSubmitted.viewOpen')}
            </Button>

            <Button
              onClick={() => navigate('/')}
              variant="secondary"
              ariaLabel={t('requestSubmitted.backHome')}
            >
              {t('requestSubmitted.backHome')}
            </Button>

            <Button
              onClick={() => navigate('/request-type')}
              variant="outline"
              ariaLabel={t('requestSubmitted.submitAnother')}
            >
              {t('requestSubmitted.submitAnother')}
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

export default RequestSubmittedPage;