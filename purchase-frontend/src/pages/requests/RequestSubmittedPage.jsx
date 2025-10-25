// src/pages/RequestSubmittedPage.jsx
import React from 'react';
import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

const RequestSubmittedPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const requestType = location.state?.requestType || 'Purchase';
  const summary = location.state?.summary || null;

  const formattedCost = useMemo(() => {
    if (!summary || summary.estimatedCost === null || summary.estimatedCost === undefined) {
      return t('requestSubmitted.notAvailable');
    }

    try {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(summary.estimatedCost);
    } catch (err) {
      return summary.estimatedCost.toString();
    }
  }, [summary, t]);

  const nextApproverLabel = useMemo(() => {
    if (!summary?.nextApproval) {
      return t('requestSubmitted.noPendingApprover');
    }

    const { approverName, approverRole } = summary.nextApproval;
    if (approverName && approverRole) {
      return `${approverName} (${approverRole})`;
    }

    if (approverName) {
      return approverName;
    }

    if (approverRole) {
      return `${approverRole} (${t('requestSubmitted.pendingAssignment')})`;
    }

    return t('requestSubmitted.pendingAssignment');
  }, [summary, t]);

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

          {summary ? (
            <section className="bg-white shadow rounded-lg p-6 text-left mb-8">
              <h2 className="text-xl font-semibold mb-4">
                {t('requestSubmitted.detailsHeading')}
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t('requestSubmitted.requestIdLabel')}
                  </dt>
                  <dd className="text-base text-gray-900">
                    {summary.requestId ?? t('requestSubmitted.notAvailable')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t('requestSubmitted.estimatedCostLabel')}
                  </dt>
                  <dd className="text-base text-gray-900">{formattedCost}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t('requestSubmitted.attachmentsUploadedLabel')}
                  </dt>
                  <dd className="text-base text-gray-900">
                    {summary.attachmentsUploaded ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t('requestSubmitted.nextApproverLabel')}
                  </dt>
                  <dd className="text-base text-gray-900">{nextApproverLabel}</dd>
                </div>
                {summary.nextApproval?.level && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      {t('requestSubmitted.pendingStepLabel')}
                    </dt>
                    <dd className="text-base text-gray-900">
                      {t('requestSubmitted.levelLabel', {
                        level: summary.nextApproval.level,
                      })}
                    </dd>
                  </div>
                )}
                {summary.message && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      {t('requestSubmitted.statusMessageLabel')}
                    </dt>
                    <dd className="text-base text-gray-900">{summary.message}</dd>
                  </div>
                )}
              </dl>

              {summary.duplicateDetected && (
                <p className="mt-4 text-sm text-amber-600">
                  {t('requestSubmitted.duplicateWarning')}
                </p>
              )}
            </section>
          ) : (
            <p className="text-sm text-gray-500 mb-8">
              {t('requestSubmitted.missingSummary')}
            </p>
          )}

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