// src/pages/RequestSubmittedPage.jsx
import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { useTranslation } from "react-i18next";
import { deriveItemPurchaseState } from "../../utils/itemPurchaseStatus";
import { buildRequestSubmissionState } from "../../utils/requestSubmission";
import {
  Check,
  CheckCircle2,
  FileText,
  Paperclip,
  UserRound,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import "./RequestSubmittedPage.css";

const RequestSubmittedPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const requestType = location.state?.requestType || "Purchase";
  const normalizedSubmission = useMemo(
    () => buildRequestSubmissionState(requestType, location.state || {}),
    [location.state, requestType],
  );

  const summary = useMemo(
    () =>
      location.state?.summary ||
      normalizedSubmission.summary ||
      (location.state?.requestId || location.state?.statusMessage
        ? {
            requestId: location.state?.requestId ?? null,
            estimatedCost: null,
            attachmentsUploaded: 0,
            nextApproval: null,
            duplicateDetected: false,
            message:
              location.state?.statusMessage || location.state?.message || "",
          }
        : null),
    [location.state, normalizedSubmission.summary],
  );

  const items = Array.isArray(location.state?.items)
    ? location.state.items
    : normalizedSubmission.items;

  const formattedCost = useMemo(() => {
    if (
      !summary ||
      summary.estimatedCost === null ||
      summary.estimatedCost === undefined
    ) {
      return t("requestSubmitted.notAvailable");
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
      return t("requestSubmitted.noPendingApprover");
    }

    const { approverName, approverRole } = summary.nextApproval;
    if (approverName && approverRole) {
      return `${approverName} (${approverRole})`;
    }

    if (approverName) {
      return approverName;
    }

    if (approverRole) {
      return `${approverRole} (${t("requestSubmitted.pendingAssignment")})`;
    }

    return t("requestSubmitted.pendingAssignment");
  }, [summary, t]);

  const itemStatusLabels = useMemo(
    () => ({
      purchased: t("requestSubmitted.itemStatus.purchased", "Purchased"),
      partiallyPurchased: t(
        "requestSubmitted.itemStatus.partiallyPurchased",
        "Partially purchased",
      ),
      notPurchased: t(
        "requestSubmitted.itemStatus.notPurchased",
        "Not purchased",
      ),
    }),
    [t],
  );

  return (
    <main className="submission-page">
      <header className="submission-hero">
        <div className="submission-success-icon">
          <Check size={32} aria-hidden="true" />
        </div>
        <div>
          <span className="submission-eyebrow">
            {t("requestSubmitted.confirmation", "Submission confirmation")}
          </span>
          <h1>{t("requestSubmitted.title", { type: requestType })}</h1>
          <p>{t("requestSubmitted.pending")}</p>
        </div>
      </header>

      {summary ? (
        <section
          className="submission-card"
          aria-labelledby="submission-summary-heading"
        >
          <div className="submission-section-heading">
            <h2 id="submission-summary-heading">
              {t("requestSubmitted.detailsHeading")}
            </h2>
            <CheckCircle2
              size={20}
              className="submission-check"
              aria-hidden="true"
            />
          </div>
          <dl className="submission-metrics">
            <div>
              <dt>
                <FileText size={16} aria-hidden="true" />
                {t("requestSubmitted.requestIdLabel")}
              </dt>
              <dd>{summary.requestId ?? t("requestSubmitted.notAvailable")}</dd>
            </div>
            <div>
              <dt>{t("requestSubmitted.estimatedCostLabel")}</dt>
              <dd>{formattedCost}</dd>
            </div>
            <div>
              <dt>
                <Paperclip size={16} aria-hidden="true" />
                {t("requestSubmitted.attachmentsUploadedLabel")}
              </dt>
              <dd>{summary.attachmentsUploaded ?? 0}</dd>
            </div>
          </dl>
          <div className="submission-details">
            <div className="submission-approval">
              <UserRound size={22} aria-hidden="true" />
              <dl>
                <div>
                  <dt>{t("requestSubmitted.nextApproverLabel")}</dt>
                  <dd>{nextApproverLabel}</dd>
                </div>
                {summary.nextApproval?.level !== null &&
                  summary.nextApproval?.level !== undefined && (
                    <div className="submission-level">
                      <dt>{t("requestSubmitted.pendingStepLabel")}</dt>
                      <dd>
                        {t("requestSubmitted.levelLabel", {
                          level: summary.nextApproval.level,
                        })}
                      </dd>
                    </div>
                  )}
              </dl>
            </div>
            {summary.message && (
              <dl className="submission-message">
                <dt>{t("requestSubmitted.statusMessageLabel")}</dt>
                <dd>{summary.message}</dd>
              </dl>
            )}
          </div>
          {summary.duplicateDetected && (
            <div className="submission-warning" role="note">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <h3>
                  {t(
                    "requestSubmitted.duplicateHeading",
                    "Possible duplicate request",
                  )}
                </h3>
                <p>{t("requestSubmitted.duplicateWarning")}</p>
              </div>
            </div>
          )}
        </section>
      ) : (
        <p className="submission-card submission-empty">
          {t("requestSubmitted.missingSummary")}
        </p>
      )}

      <section className="submission-card">
        <div className="submission-section-heading">
          <h2 id="submission-items-heading">
            {t("requestSubmitted.itemsHeading")}
          </h2>
          {items.length > 0 && (
            <span className="submission-item-count">
              {t("requestSubmitted.lineItems", {
                count: items.length,
                defaultValue: "{{count}} line items",
              })}
            </span>
          )}
        </div>
        {items.length > 0 ? (
          <div
            className="submission-table-scroll"
            tabIndex={0}
            role="region"
            aria-labelledby="submission-items-heading"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("requestSubmitted.itemNameHeader")}</th>
                  <th scope="col" className="submission-number">
                    {t("requestSubmitted.itemQuantityHeader")}
                  </th>
                  <th scope="col" className="submission-number">
                    {t("requestSubmitted.itemPurchasedHeader")}
                  </th>
                  <th scope="col">{t("requestSubmitted.itemStatusHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const { statusKey, quantity, purchasedQuantity } =
                    deriveItemPurchaseState(item);
                  return (
                    <tr key={item.id ?? index}>
                      <td>{item.name || t("requestSubmitted.unnamedItem")}</td>
                      <td className="submission-number">{quantity ?? 0}</td>
                      <td className="submission-number">
                        {purchasedQuantity ?? 0}
                      </td>
                      <td>
                        <span
                          className={`submission-item-status submission-item-status--${statusKey}`}
                        >
                          {itemStatusLabels[statusKey] ??
                            itemStatusLabels.notPurchased}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="submission-empty">{t("requestSubmitted.noItems")}</p>
        )}
      </section>

      <footer className="submission-actions">
        <Button
          onClick={() => navigate("/open-requests")}
          variant="primary"
          ariaLabel={t("requestSubmitted.viewOpen")}
        >
          {t("requestSubmitted.viewOpen")}
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
        <Button
          onClick={() => navigate("/request-type")}
          variant="secondary"
          ariaLabel={t("requestSubmitted.submitAnother")}
        >
          {t("requestSubmitted.submitAnother")}
        </Button>
        <Button
          onClick={() => navigate("/")}
          variant="secondary"
          className="submission-home"
          ariaLabel={t("requestSubmitted.backHome")}
        >
          {t("requestSubmitted.backHome")}
        </Button>
      </footer>
    </main>
  );
};

export default RequestSubmittedPage;
