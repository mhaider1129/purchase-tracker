//src/pages/ApprovalsPanel.js
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCcw,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/Button';
import useCurrentUser from '../hooks/useCurrentUser';
import useApprovalsData from '../hooks/useApprovalsData';
import ApprovalsFilters from '../components/approvals/ApprovalsFilters';
import ApprovalRequestCard from '../components/approvals/ApprovalRequestCard';
import AttachmentsPanel from '../components/approvals/AttachmentsPanel';
import ItemDecisionTable from '../components/approvals/ItemDecisionTable';
import { getRequesterDisplay } from '../utils/requester';

const ApprovalsPanel = () => {
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

  const filterLabels = {
    searchPlaceholder: 'Search by ID, justification, department or section',
    typeLabel: 'Request Type',
    typeAllLabel: 'All types',
    urgencyLabel: 'Urgency',
    sortLabel: 'Sort by',
    resetLabel: 'Reset filters',
  };

  const itemLabels = {
    heading: 'Requested Items',
    saveLabel: 'Save Item Decisions',
    quantityLabel: 'Qty',
    availableLabel: 'Available Qty',
    unitCostLabel: 'Unit Cost',
    totalCostLabel: 'Total',
    decisionLabel: 'Decision',
    commentsLabel: 'Comments',
    approvedLabel: 'Approved',
    rejectedLabel: 'Rejected',
    pendingLabel: 'Pending',
    emptyLabel: 'No items found for this request.',
  };

  const modalTitles = {
    hod: 'Send to Department HOD',
    hodDescription: 'Add a department HOD approval step before continuing the workflow.',
    hodSelect: 'Select department HOD',
  };

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Pending & On-Hold Approvals</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Review, pause, or continue approval requests from your departments.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchApprovals} variant="secondary" aria-label="Refresh approvals list">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-600" aria-hidden />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4 text-slate-600" aria-hidden />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pending</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.total}</p>
              </div>
              <PackageCheck className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Urgent</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.urgent}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Estimated Total (IQD)</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.estimatedTotal.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-emerald-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Requests by Type</p>
                {Object.keys(summary.byType).length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No type data</p>
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

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-600" aria-hidden />
              <span className="text-sm text-slate-600">Loading approvals...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
          ) : requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No pending approvals.
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              <p>No pending approvals match the selected filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-blue-600 underline"
                  onClick={clearFilters}
                >
                  Clear filters
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
                  >
                    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                      <div className="space-y-4">
                        {user?.role === 'SCM' && (
                          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                            <label
                              htmlFor={`scm-estimated-cost-${req.request_id}`}
                              className="block text-sm font-medium text-blue-900"
                            >
                              Update Estimated Cost (IQD)
                            </label>
                            <input
                              id={`scm-estimated-cost-${req.request_id}`}
                              type="text"
                              inputMode="decimal"
                              className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder="Add an estimated total before approving"
                              value={estimatedCostDrafts[req.request_id] ?? ''}
                              onChange={(event) => handleEstimatedCostDraftChange(req.request_id, event.target.value)}
                            />
                            <p className="mt-1 text-xs text-blue-800">
                              This amount will be confirmed when you approve or reject the request. Leave blank to keep the existing value.
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

                      <div className="space-y-4">
                        {req.is_urgent && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                            Requires immediate attention
                          </div>
                        )}
      <div className="space-y-3">
        <Button
          variant="outline"
                            onClick={() =>
                              toggleApprovalHoldStatus(req.approval_id, req.request_id, !isOnHold)
                            }
                            isLoading={holdLoading}
                          >
                            {isOnHold ? 'Resume Approval' : 'Put On Hold'}
                          </Button>
                          {isOnHold && (
                            <p className="text-xs text-amber-700">
                              This approval is currently on hold. Resume it to approve or reject the request.
                            </p>
                          )}
                          {user?.role === 'SCM' && (
                            <Button variant="secondary" onClick={() => openHodModal(req.request_id)}>
                              Send to Department HOD
                            </Button>
                          )}
                          {req.request_type === 'Maintenance' && req.approval_level === 1 ? (
                            <Button onClick={() => reassignToDepartmentRequester(req.request_id, req.approval_id)}>
                              Assign to Department Requester
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => openCommentModal(req.approval_id, req.request_id, 'Approved')}
                                disabled={isOnHold}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => openCommentModal(req.approval_id, req.request_id, 'Rejected')}
                                disabled={isOnHold}
                              >
                                Reject
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
                <span>Loading HOD approvers...</span>
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
                  <option value="">Choose a HOD</option>
                  {hodOptions.map((hod) => (
                    <option key={hod.id} value={hod.id}>
                      {hod.name || 'HOD'} {hod.department_name ? `— ${hod.department_name}` : ''}
                    </option>
                  ))}
                </select>
                {!hodOptionsLoading && hodOptions.length === 0 && (
                  <p className="text-sm text-slate-500">No active HOD approvers are available.</p>
                )}
                {hodOptionsError && <p className="text-sm text-red-600">{hodOptionsError}</p>}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-500">
              The selected HOD will receive a pending approval before the request continues to the next level.
            </p>

            <div className="mt-4 flex justify-end gap-3">
              <Button
                onClick={submitHodForward}
                isLoading={hodSubmitLoading}
                disabled={hodSubmitLoading || hodOptionsLoading}
              >
                Send
              </Button>
              <Button variant="ghost" onClick={() => setSelectedHodId('')} disabled={hodSubmitLoading}>
                Clear
              </Button>
              <Button variant="ghost" onClick={closeHodModal} disabled={hodSubmitLoading}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCommentBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {selectedDecision === 'Approved' ? 'Approve' : 'Reject'} Request #{selectedRequestId}
            </h2>
            <textarea
              className="mt-3 h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter optional comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            {user?.role === 'SCM' && (
              <div className="mt-3">
                <label htmlFor="estimated-cost" className="block text-sm font-medium text-slate-700">
                  Estimated Cost (IQD)
                </label>
                <input
                  id="estimated-cost"
                  type="text"
                  inputMode="decimal"
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    estimatedCostError ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="Enter a number or leave blank"
                  value={estimatedCost}
                  onChange={(e) => handleModalEstimatedCostChange(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Provide an updated estimate so downstream approvers can see the projected cost. Leave blank to keep the current
                  value.
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
                  Mark this request as <span className="font-semibold text-red-600">Urgent</span>
                </label>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <Button onClick={submitDecision}>Submit</Button>
              <Button variant="ghost" onClick={resetCommentModal}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApprovalsPanel;