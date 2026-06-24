//src/pages/ApprovalsPanel.js
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import useCurrentUser from '../hooks/useCurrentUser';
import useApprovalsData from '../hooks/useApprovalsData';
import ApprovalsFilters from '../components/approvals/ApprovalsFilters';
import ApprovalRequestCard from '../components/approvals/ApprovalRequestCard';
import AttachmentsPanel from '../components/approvals/AttachmentsPanel';
import ItemDecisionTable from '../components/approvals/ItemDecisionTable';
import { getRequesterDisplay } from '../utils/requester';
import GuidedWorkflowPanel from '../components/GuidedWorkflowPanel';
import AmountInput from '../components/ui/AmountInput';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import RequestViewModeToggle from '../components/requests/RequestViewModeToggle';
import usePersistedRequestViewMode, { REQUEST_VIEW_MODES } from '../hooks/usePersistedRequestViewMode';

const ApprovalsPanel = () => {
  const { t } = useTranslation();
  const [onboardingVersion, setOnboardingVersion] = useState(0);
  const [requestViewMode, setRequestViewMode] = usePersistedRequestViewMode(
    'approvals-request-view-mode',
  );
  const { user } = useCurrentUser();
  const {
    availableRequestTypes,
    attachmentErrorMap,
    attachmentLoadingMap,
    attachmentsMap,
    canMarkUrgent,
    clearFilters,
    comments,
    downloadingAttachmentId,
    error,
    estimatedCost,
    estimatedCostDrafts,
    estimatedCostError,
    expandedId,
    fetchApprovals,
    filteredRequests,
    formatDateTime,
    getCostLabel,
    handleDownloadAttachment,
    handleEstimatedCostDraftChange,
    handleItemCommentChange,
    handleItemQuantityChange,
    handleItemStatusChange,
    handleModalEstimatedCostChange,
    hasActiveFilters,
    hodOptions,
    hodOptionsError,
    hodOptionsLoading,
    hodSubmitLoading,
    holdLoadingMap,
    isUrgent,
    isItemLockedForUser,
    itemDecisions,
    itemFeedback,
    itemsMap,
    itemQuantityDrafts,
    itemSummaries,
    loading,
    openCommentModal,
    openHodModal,
    closeHodModal,
    reassignToDepartmentRequester,
    requests,
    resetCommentModal,
    saveItemDecisions,
    savingItems,
    searchTerm,
    selectedDecision,
    selectedHodId,
    selectedRequestId,
    setComments,
    setHodOptionsError,
    setIsUrgent,
    setSearchTerm,
    setSelectedHodId,
    setSortOption,
    setTypeFilter,
    setUrgencyFilter,
    showCommentBox,
    showHodModal,
    sortOption,
    submitDecision,
    submitHodForward,
    toggleApprovalHoldStatus,
    summary,
    toggleExpand,
    typeFilter,
    urgencyFilter,
  } = useApprovalsData(user);

  const {
    approvalsMap,
    expandedApprovalsId,
    loadingApprovalsId,
    toggleApprovals,
  } = useApprovalTimeline();

  const filterLabels = {
    searchPlaceholder: t('approvalsPanel.filters.searchPlaceholder'),
    typeLabel: t('approvalsPanel.filters.requestType'),
    typeAllLabel: t('approvalsPanel.filters.allTypes'),
    urgencyLabel: t('approvalsPanel.filters.urgency'),
    sortLabel: t('approvalsPanel.filters.sortBy'),
    resetLabel: t('approvalsPanel.filters.reset'),
    urgencyOptions: [
      { value: 'all', label: t('approvalsPanel.filters.urgencyAll') },
      { value: 'urgent', label: t('approvalsPanel.filters.urgentOnly') },
      { value: 'non-urgent', label: t('approvalsPanel.filters.nonUrgent') },
    ],
    sortOptions: [
      { value: 'newest', label: t('approvalsPanel.filters.newest') },
      { value: 'oldest', label: t('approvalsPanel.filters.oldest') },
      { value: 'costHigh', label: t('approvalsPanel.filters.costHigh') },
      { value: 'costLow', label: t('approvalsPanel.filters.costLow') },
    ],
  };

  const itemLabels = {
    heading: t('approvalsPanel.items.heading'),
    saveLabel: t('approvalsPanel.items.save'),
    quantityLabel: t('approvalsPanel.items.qty'),
    availableLabel: t('approvalsPanel.items.availableQty'),
    unitCostLabel: t('approvalsPanel.items.unitCost'),
    totalCostLabel: t('approvalsPanel.items.total'),
    decisionLabel: t('approvalsPanel.items.decision'),
    commentsLabel: t('approvalsPanel.items.comments'),
    approvedLabel: t('approvalsPanel.items.approved'),
    rejectedLabel: t('approvalsPanel.items.rejected'),
    pendingLabel: t('approvalsPanel.items.pending'),
    emptyLabel: t('approvalsPanel.items.empty'),
  };

  const modalTitles = {
    hod: t('approvalsPanel.hodModal.title'),
    hodDescription: t('approvalsPanel.hodModal.description'),
    hodSelect: t('approvalsPanel.hodModal.select'),
  };
  const autoCompletedOnboardingSteps = [
    hasActiveFilters ? 'filter_queue' : null,
    expandedId ? 'review_items' : null,
    selectedDecision ? 'submit_decision' : null,
  ].filter(Boolean);
  const isCompactRequestView = requestViewMode === REQUEST_VIEW_MODES.summary;


  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{t('approvalsPanel.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {t('approvalsPanel.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchApprovals} variant="secondary" aria-label={t('approvalsPanel.actions.refreshAria')}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-600" aria-hidden />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4 text-slate-600" aria-hidden />
              )}
              {t('approvalsPanel.actions.refresh')}
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <GuidedWorkflowPanel
            key={onboardingVersion}
            title={t('approvalsPanel.onboarding.title')}
            subtitle={t('approvalsPanel.onboarding.subtitle')}
            storageKey="onboarding-approvals"
            onCompleteStep={() => setOnboardingVersion((v) => v + 1)}
            autoCompleteStepIds={autoCompletedOnboardingSteps}
            steps={[
              { id: 'filter_queue', title: t('approvalsPanel.onboarding.filterTitle'), tip: t('approvalsPanel.onboarding.filterTip') },
              { id: 'review_items', title: t('approvalsPanel.onboarding.reviewTitle'), tip: t('approvalsPanel.onboarding.reviewTip') },
              { id: 'submit_decision', title: t('approvalsPanel.onboarding.decisionTitle'), tip: t('approvalsPanel.onboarding.decisionTip') },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('approvalsPanel.stats.totalPending')}</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.total}</p>
              </div>
              <PackageCheck className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('approvalsPanel.stats.urgent')}</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.urgent}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('approvalsPanel.stats.estimatedTotal')}</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.estimatedTotal.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-emerald-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('approvalsPanel.stats.requestsByType')}</p>
                {Object.keys(summary.byType).length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">{t('approvalsPanel.stats.noTypeData')}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <li key={type} className="flex items-center justify-between">
                        <span>{type}</span>
                        <span className="font-semibold text-slate-900">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Building2 className="h-8 w-8 text-emerald-600" aria-hidden />
            </div>
          </div>
        </div>

        <ApprovalsFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          urgencyFilter={urgencyFilter}
          onUrgencyChange={setUrgencyFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          availableRequestTypes={availableRequestTypes}
          hasActiveFilters={hasActiveFilters}
          onReset={clearFilters}
          labels={filterLabels}
        />

        <RequestViewModeToggle
          className="mt-4"
          value={requestViewMode}
          onChange={setRequestViewMode}
          title={t('approvalsPanel.requestView.title')}
          description={t('approvalsPanel.requestView.description')}
          detailedLabel={t('approvalsPanel.requestView.detailed')}
          summaryLabel={t('approvalsPanel.requestView.summary')}
          ariaLabel={t('approvalsPanel.requestView.aria')}
        />

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-600" aria-hidden />
              <span className="text-sm text-slate-600">{t('approvalsPanel.states.loading')}</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
          ) : requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              {t('approvalsPanel.states.empty')}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              <p>{t('approvalsPanel.states.emptyFiltered')}</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-blue-600 underline"
                  onClick={clearFilters}
                >
                  {t('approvalsPanel.states.clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {filteredRequests.map((req) => {
                const estimatedCostValue = Number(req.estimated_cost) || 0;
                const costTag = getCostLabel(estimatedCostValue);
                const canEditItems = true;
                const attachments = attachmentsMap[req.request_id] || [];
                const attachmentsLoading = attachmentLoadingMap[req.request_id];
                const attachmentsError = attachmentErrorMap[req.request_id];
                const isExpanded = expandedId === req.request_id;
                const requesterDisplay = getRequesterDisplay(req);
                const approvalStatus = req.approval_status || 'Pending';
                const isOnHold = approvalStatus.toLowerCase() === 'on hold';
                const holdLoading = Boolean(holdLoadingMap[req.approval_id]);

                return (
                  <ApprovalRequestCard
                    key={req.approval_id}
                    request={req}
                    requesterDisplay={requesterDisplay}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(req.request_id)}
                    formatDateTime={formatDateTime}
                    estimatedCostValue={estimatedCostValue}
                    costTag={costTag}
                    approvalStatus={approvalStatus}
                    compactView={isCompactRequestView}
                    summaryStats={{
                      itemsCount: (itemsMap[req.request_id] || []).length,
                      attachmentsCount: attachments.length,
                    }}
                  >
                    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                      <div className="order-2 space-y-4 lg:order-1">
                        {user?.role === 'SCM' && (
                          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                            <label
                              htmlFor={`scm-estimated-cost-${req.request_id}`}
                              className="block text-sm font-medium text-blue-900"
                            >
                              {t('approvalsPanel.cost.updateEstimated')}
                            </label>
                            <AmountInput
                              id={`scm-estimated-cost-${req.request_id}`}
                              className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder={t('approvalsPanel.cost.placeholder')}
                              value={estimatedCostDrafts[req.request_id] ?? ''}
                              onChange={(event) => handleEstimatedCostDraftChange(req.request_id, event.target.value)}
                            />
                            <p className="mt-1 text-xs text-blue-800">
                              {t('approvalsPanel.cost.helper')}
                            </p>
                          </div>
                        )}

                        <AttachmentsPanel
                          attachments={attachments}
                          loading={attachmentsLoading}
                          error={attachmentsError}
                          downloadingId={downloadingAttachmentId}
                          onDownload={handleDownloadAttachment}
                          onView={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                        />

                        <ItemDecisionTable
                          items={itemsMap[req.request_id] || []}
                          decisions={itemDecisions[req.request_id] || {}}
                          quantityDrafts={itemQuantityDrafts[req.request_id] || {}}
                          canEdit={canEditItems}
                          isItemLockedForUser={isItemLockedForUser}
                          onStatusChange={(itemId, status) =>
                            handleItemStatusChange(req.request_id, itemId, status)
                          }
                          onCommentChange={(itemId, value) =>
                            handleItemCommentChange(req.request_id, itemId, value)
                          }
                          onQuantityChange={(itemId, value) =>
                            handleItemQuantityChange(req.request_id, itemId, value)
                          }
                          onSave={() => saveItemDecisions(req.request_id, req.approval_id)}
                          saving={!!savingItems[req.request_id]}
                          summary={itemSummaries[req.request_id]}
                          feedback={itemFeedback[req.request_id]}
                          labels={itemLabels}
                        />
                      </div>

                      <div className="order-1 space-y-4 lg:order-2">
                        {req.is_urgent && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                            {t('approvalsPanel.status.requiresAttention')}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Link
                            to={`/requests/${req.request_id}`}
                            className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            {t('approvalsPanel.actions.openWorkspace')}
                          </Link>
                          <Button
                            variant="secondary"
                            className="flex items-center gap-2"
                            onClick={() => toggleApprovals(req.request_id)}
                            isLoading={loadingApprovalsId === req.request_id}
                          >
                            <FileText className="h-4 w-4" aria-hidden />
                            {expandedApprovalsId === req.request_id ? t('approvalsPanel.actions.hideApprovals') : t('approvalsPanel.actions.viewApprovals')}
                          </Button>
                          {expandedApprovalsId === req.request_id && (
                            <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                              <ApprovalTimeline
                                approvals={approvalsMap[req.request_id]}
                                isLoading={loadingApprovalsId === req.request_id}
                                isUrgent={Boolean(req?.is_urgent)}
                              />
                            </div>
                          )}
                        </div>
      <div className="space-y-3">
        <Button
          variant="outline"
                            onClick={() =>
                              toggleApprovalHoldStatus(req.approval_id, req.request_id, !isOnHold)
                            }
                            isLoading={holdLoading}
                          >
                            {isOnHold ? t('approvalsPanel.actions.resumeApproval') : t('approvalsPanel.actions.putOnHold')}
                          </Button>
                          {isOnHold && (
                            <p className="text-xs text-amber-700">
                              {t('approvalsPanel.status.onHoldHelp')}
                            </p>
                          )}
                          {user?.role === 'SCM' && (
                            <Button variant="secondary" onClick={() => openHodModal(req.request_id)}>
                              {t('approvalsPanel.actions.sendToHod')}
                            </Button>
                          )}
                          {req.request_type === 'Maintenance' && req.approval_level === 1 ? (
                            <Button onClick={() => reassignToDepartmentRequester(req.request_id, req.approval_id)}>
                              {t('approvalsPanel.actions.assignRequester')}
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => openCommentModal(req.approval_id, req.request_id, 'Approved')}
                                disabled={isOnHold}
                              >
                                {t('approvalsPanel.actions.approve')}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => openCommentModal(req.approval_id, req.request_id, 'Rejected')}
                                disabled={isOnHold}
                              >
                                {t('approvalsPanel.actions.reject')}
                              </Button>
                            </>
          )}

        </div>
      </div>
    </div>
                  </ApprovalRequestCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showHodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{modalTitles.hod}</h2>
            <p className="mt-1 text-sm text-slate-600">{modalTitles.hodDescription}</p>

            {hodOptionsLoading ? (
              <div className="mt-4 flex items-center gap-2 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{t('approvalsPanel.hodModal.loading')}</span>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <label htmlFor="hod-select" className="text-sm font-medium text-slate-700">
                  {modalTitles.hodSelect}
                </label>
                <select
                  id="hod-select"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedHodId}
                  onChange={(e) => {
                    setSelectedHodId(e.target.value);
                    setHodOptionsError('');
                  }}
                >
                  <option value="">{t('approvalsPanel.hodModal.choose')}</option>
                  {hodOptions.map((hod) => (
                    <option key={hod.id} value={hod.id}>
                      {hod.name || t('approvalsPanel.hodModal.fallback')} {hod.department_name ? `— ${hod.department_name}` : ''}
                    </option>
                  ))}
                </select>
                {!hodOptionsLoading && hodOptions.length === 0 && (
                  <p className="text-sm text-slate-500">{t('approvalsPanel.hodModal.empty')}</p>
                )}
                {hodOptionsError && <p className="text-sm text-red-600">{hodOptionsError}</p>}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-500">
              {t('approvalsPanel.hodModal.helper')}
            </p>

            <div className="mt-4 flex justify-end gap-3">
              <Button
                onClick={submitHodForward}
                isLoading={hodSubmitLoading}
                disabled={hodSubmitLoading || hodOptionsLoading}
              >
                {t('approvalsPanel.actions.send')}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedHodId('')} disabled={hodSubmitLoading}>
                {t('approvalsPanel.actions.clear')}
              </Button>
              <Button variant="ghost" onClick={closeHodModal} disabled={hodSubmitLoading}>
                {t('approvalsPanel.actions.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCommentBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {t('approvalsPanel.decisionModal.title', { decision: selectedDecision === 'Approved' ? t('approvalsPanel.actions.approve') : t('approvalsPanel.actions.reject'), id: selectedRequestId })}
            </h2>
            <textarea
              className="mt-3 h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('approvalsPanel.decisionModal.commentsPlaceholder')}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            {user?.role === 'SCM' && (
              <div className="mt-3">
                <label htmlFor="estimated-cost" className="block text-sm font-medium text-slate-700">
                  {t('approvalsPanel.cost.modalLabel')}
                </label>
                <AmountInput
                  id="estimated-cost"
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    estimatedCostError ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder={t('approvalsPanel.cost.modalPlaceholder')}
                  value={estimatedCost}
                  onChange={(e) => handleModalEstimatedCostChange(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t('approvalsPanel.cost.modalHelper')}
                </p>
                {estimatedCostError && <p className="mt-1 text-xs text-red-600">{estimatedCostError}</p>}
              </div>
            )}
            {canMarkUrgent && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="urgent" className="text-sm font-medium">
                  {t('approvalsPanel.decisionModal.markUrgent')} <span className="font-semibold text-red-600">{t('approvalsPanel.stats.urgent')}</span>
                </label>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <Button onClick={submitDecision}>{t('approvalsPanel.actions.submit')}</Button>
              <Button variant="ghost" onClick={resetCommentModal}>
                {t('approvalsPanel.actions.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApprovalsPanel;