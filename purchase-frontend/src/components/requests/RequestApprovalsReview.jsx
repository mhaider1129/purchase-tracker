import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { matchesSearchTokens } from "../../utils/search";
import "./RequestApprovalsReview.css";
const statusOf = (entry) =>
  String(entry.status || "")
    .trim()
    .toLowerCase();
export const approvalMatchesView = (entry, view) => {
  const status = statusOf(entry);
  if (view === "pending") return status === "pending";
  if (view === "active")
    return status === "pending" && entry.is_active === true;
  if (view === "decisions") return ["approved", "rejected"].includes(status);
  return true;
};
export default function RequestApprovalsReview({ approvals = [] }) {
  const { t } = useTranslation();
  const tr = (key, options) => t(`requestApprovalsReview.${key}`, options);
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      approvals.filter(
        (entry) =>
          approvalMatchesView(entry, view) &&
          matchesSearchTokens(query, [
            entry.approver_name,
            entry.approver_role,
            entry.comments,
            entry.approval_level,
            entry.status,
          ]),
      ),
    [approvals, view, query],
  );
  const reset = () => {
    setView("all");
    setQuery("");
  };
  return (
    <section className="request-approvals-review" aria-label={tr("title")}>
      <header className="request-approvals-toolbar print:hidden">
        <h2>{tr("title")}</h2>
        <p>{tr("hint")}</p>
        <div
          role="group"
          aria-label={tr("views")}
          className="request-approvals-views"
        >
          {["all", "pending", "active", "decisions"].map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {tr(key)}{" "}
              <span>
                {
                  approvals.filter((entry) => approvalMatchesView(entry, key))
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <label>
          {tr("search")}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("placeholder")}
          />
        </label>
        <div className="request-approvals-results">
          <p role="status">
            {tr("showing", {
              visible: filtered.length,
              total: approvals.length,
            })}
          </p>
          {(view !== "all" || query.trim()) && (
            <button type="button" onClick={reset}>
              {tr("reset")}
            </button>
          )}
        </div>
      </header>
      <ol className="request-approvals-list">
        {filtered.map((entry, index) => {
          const status = statusOf(entry);
          const date = entry.approved_at ? new Date(entry.approved_at) : null;
          const hours = entry.waiting_time_hours;
          const knownHours =
            hours !== null &&
            hours !== undefined &&
            hours !== "" &&
            Number.isFinite(Number(hours));
          return (
            <li
              key={entry.approval_id ?? index}
              className={`request-approval-entry request-approval-entry--${["approved", "rejected", "pending"].includes(status) ? status : "other"}`}
            >
              <div className="request-approval-heading">
                <div>
                  <p>
                    {tr("level")} {entry.approval_level ?? "—"}
                  </p>
                  <h3>{entry.approver_name || tr("unassigned")}</h3>
                  <span>{entry.approver_role || tr("roleMissing")}</span>
                </div>
                <div className="request-approval-badges">
                  <span>
                    {["pending", "approved", "rejected"].includes(status)
                      ? tr(status)
                      : entry.status || tr("unknown")}
                  </span>
                  {approvalMatchesView(entry, "active") && (
                    <strong>{tr("activeStep")}</strong>
                  )}
                </div>
              </div>
              <p className="request-approval-comment">
                {entry.comments || tr("noComments")}
              </p>
              <dl>
                <div>
                  <dt>{tr("date")}</dt>
                  <dd>
                    {date && Number.isFinite(date.getTime())
                      ? date.toLocaleString()
                      : tr("notRecorded")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("waiting")}</dt>
                  <dd>
                    {knownHours
                      ? Math.max(0, Number(hours)).toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })
                      : tr("notRecorded")}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
      {!filtered.length && (
        <p className="request-approvals-empty">
          {tr(approvals.length ? "noMatches" : "empty")}
        </p>
      )}
    </section>
  );
}
