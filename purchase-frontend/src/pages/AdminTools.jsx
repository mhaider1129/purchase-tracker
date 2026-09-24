// src/pages/AdminTools.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useTranslation } from "react-i18next";
import usePageTranslation from "../utils/usePageTranslation";
import PaginationControls from "../components/ui/PaginationControls";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserX,
  Workflow,
  X,
} from "lucide-react";

const AdminTools = () => {
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [deactivateEmail, setDeactivateEmail] = useState("");
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [hasFetchedLogs, setHasFetchedLogs] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [reassignStats, setReassignStats] = useState(null);
  const { t, i18n } = useTranslation();
  const tr = usePageTranslation("adminTools");
  const logsPerPage = 10;
  const navigate = useNavigate();

  const clearMessage = () => setMessage("");

  const localeForExport = i18n.language?.startsWith("ar") ? "ar-SA" : "en-US";

  const exportHeaders = [
    { key: "id", label: tr("export.headers.id", "Log ID") },
    { key: "requestId", label: tr("export.headers.requestId", "Request ID") },
    {
      key: "approvalId",
      label: tr("export.headers.approvalId", "Approval ID"),
    },
    { key: "actor", label: tr("export.headers.actor", "Actor") },
    { key: "actorId", label: tr("export.headers.actorId", "Actor ID") },
    { key: "action", label: tr("export.headers.action", "Action") },
    { key: "comments", label: tr("export.headers.comments", "Comments") },
    { key: "type", label: tr("export.headers.type", "Type") },
    {
      key: "justification",
      label: tr("export.headers.justification", "Request Justification"),
    },
    { key: "createdAt", label: tr("export.headers.createdAt", "Created At") },
    { key: "raw", label: tr("export.headers.raw", "Raw Entry") },
  ];

  const sanitizeValue = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    return String(value);
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString(localeForExport, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      console.warn("Failed to format date for export:", error);
      return sanitizeValue(value);
    }
  };

  const normalizeLogForExport = (entry) => {
    if (!entry || typeof entry !== "object") {
      return {
        id: "",
        requestId: "",
        approvalId: "",
        actor: "",
        actorId: "",
        action: "",
        comments: "",
        type: "",
        justification: "",
        createdAt: "",
        raw: sanitizeValue(entry),
      };
    }

    return {
      id: sanitizeValue(entry.id),
      requestId: sanitizeValue(entry.request_id),
      approvalId: sanitizeValue(entry.approval_id),
      actor: sanitizeValue(entry.actor_name),
      actorId: sanitizeValue(entry.actor_id),
      action: sanitizeValue(entry.action),
      comments: sanitizeValue(entry.comments || entry.description),
      type: sanitizeValue(entry.log_type),
      justification: sanitizeValue(entry.justification),
      createdAt: formatDateTime(entry.created_at || entry.timestamp),
      raw: "",
    };
  };

  const buildExportRows = () => filteredLogs.map(normalizeLogForExport);

  const escapeCsvValue = (value) => {
    const stringValue = sanitizeValue(value);
    if (stringValue === "") return "";
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const getExportFileName = (extension) => {
    const base = tr("systemLogsFile", "system_logs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${base}_${timestamp}.${extension}`;
  };

  // 👤 Check Access
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage(
        tr("loginRequired", "You must be logged in to access admin tools."),
      );
      navigate("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const role = payload?.role?.toLowerCase() || "";
      if (!["admin", "scm"].includes(role)) {
        alert(
          tr(
            "accessDenied",
            "🚫 Access denied: Only SCM or Admin can access this page.",
          ),
        );
        navigate("/");
      }
    } catch (error) {
      console.error("❌ Token decode failed:", error);
      navigate("/login");
    }
  }, [navigate, tr]);

  // 🔁 Reassign Approvals
  const triggerReassignment = async () => {
    if (
      !window.confirm(tr("confirmReassign", "Reassign all pending approvals?"))
    )
      return;
    setActiveAction("reassign");
    setMessage("");
    try {
      const res = await api.post("/admin-tools/reassign-approvals");
      setMessage(
        res.data?.message ||
          tr("reassignmentSuccess", "Reassignment completed."),
      );
      setReassignStats(res.data?.data || null);
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          err.response?.data?.message ||
          tr("failedReassign", "Failed to trigger reassignment."),
      );
      setReassignStats(null);
    } finally {
      setActiveAction("");
    }
  };

  // 🚫 Deactivate User
  const deactivateUser = async () => {
    if (!deactivateEmail.trim()) {
      setMessage(tr("enterEmail", "Enter user email to deactivate."));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(deactivateEmail.trim())) {
      setMessage(tr("failedDeactivate", "Failed to deactivate user."));
      return;
    }
    if (!window.confirm(tr("confirmDeactivate", "Deactivate this user?")))
      return;

    setActiveAction("deactivate");
    setMessage("");
    try {
      const res = await api.post("/admin-tools/deactivate-user", {
        email: deactivateEmail,
      });
      setMessage(
        res.data?.message || tr("deactivateUserSuccess", "User deactivated."),
      );
      setDeactivateEmail("");
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          err.response?.data?.message ||
          tr("failedDeactivate", "Failed to deactivate user."),
      );
    } finally {
      setActiveAction("");
    }
  };

  // 📜 Fetch Logs
  const fetchLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await api.get("/admin-tools/logs", {
        params: { limit: 100 },
      });
      const logs = res.data.logs || [];
      setLogs(logs);
      setFilteredLogs(logs);
      setCurrentPage(1);
      setHasFetchedLogs(true);
    } catch (err) {
      setMessage(tr("failedFetchLogs", "Failed to fetch logs."));
    } finally {
      setLogLoading(false);
    }
  }, [tr]);

  // 🔎 Filter Logs
  useEffect(() => {
    const keyword = filterKeyword.trim().toLowerCase();
    const filtered = logs.filter((log) => {
      const matchesKeyword =
        !keyword || JSON.stringify(log).toLowerCase().includes(keyword);
      const matchesType = typeFilter === "all" || log?.log_type === typeFilter;
      return matchesKeyword && matchesType;
    });
    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [filterKeyword, logs, typeFilter]);

  const logTypes = useMemo(
    () => [...new Set(logs.map((log) => log?.log_type).filter(Boolean))].sort(),
    [logs],
  );

  const latestLogTime = logs[0]?.created_at || logs[0]?.timestamp;

  const getActionTone = (action = "") => {
    const value = action.toLowerCase();
    if (
      value.includes("reject") ||
      value.includes("deactiv") ||
      value.includes("fail")
    ) {
      return "bg-rose-50 text-rose-700 ring-rose-600/10";
    }
    if (
      value.includes("approv") ||
      value.includes("creat") ||
      value.includes("complete")
    ) {
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
    }
    return "bg-blue-50 text-blue-700 ring-blue-600/10";
  };

  // 📄 Export to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      setMessage(tr("export.noLogs", "No logs available to export."));
      return;
    }

    const exportRows = buildExportRows();
    const headerRow = exportHeaders.map(({ label }) => escapeCsvValue(label));
    const bodyRows = exportRows.map((row) =>
      exportHeaders.map(({ key }) => escapeCsvValue(row[key])),
    );

    const csvContent = [headerRow, ...bodyRows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, getExportFileName("csv"));
  };

  // 📄 Export to PDF
  const exportToPDF = () => {
    if (filteredLogs.length === 0) {
      setMessage(tr("export.noLogs", "No logs available to export."));
      return;
    }

    const doc = new jsPDF();
    const exportRows = buildExportRows();
    const headers = exportHeaders.map(({ label }) => label);
    const bodyRows = exportRows.map((row) =>
      exportHeaders.map(({ key }) => sanitizeValue(row[key])),
    );

    doc.text(tr("systemLogsTitle", "System Logs"), 14, 14);
    doc.setFontSize(10);
    doc.text(
      tr("export.generatedAt", "Generated at: {{timestamp}}", {
        timestamp: new Date().toLocaleString(localeForExport),
      }),
      14,
      22,
    );

    doc.autoTable({
      head: [headers],
      body: bodyRows,
      startY: 28,
      styles: {
        fontSize: 8,
        cellWidth: "wrap",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [22, 101, 216],
        textColor: 255,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 35 },
        7: { cellWidth: 20 },
        8: { cellWidth: 45 },
        9: { cellWidth: 35 },
        10: { cellWidth: 60 },
      },
    });

    doc.save(getExportFileName("pdf"));
  };

  // 📄 Pagination Logic
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  return (
    <>
      <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-200 sm:px-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  <ShieldCheck size={16} />
                  {tr("workspace", "Operations workspace")}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {tr("title", "Admin Tools")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  {tr(
                    "subtitle",
                    "Run controlled maintenance actions and review the latest system activity from one secure workspace.",
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {tr("systemOnline", "Admin services online")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {tr("protectedActions", "Actions are permission protected")}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {message && (
            <div
              role="status"
              className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900"
            >
              <span className="flex gap-2">
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                {message}
              </span>
              <button
                aria-label={tr("dismiss", "Dismiss message")}
                onClick={clearMessage}
                className="rounded p-1 hover:bg-blue-100"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section
            aria-label={tr("overview", "Operations overview")}
            className="mb-8 grid gap-4 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  {tr("logsLoaded", "Logs loaded")}
                </span>
                <Activity className="text-blue-600" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {logs.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {tr("latestHundred", "Latest 100 activity records")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  {tr("logCategories", "Log categories")}
                </span>
                <FileText className="text-violet-600" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {logTypes.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {tr("activitySources", "Distinct activity sources")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  {tr("lastActivity", "Last activity")}
                </span>
                <RefreshCw className="text-emerald-600" size={20} />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900">
                {latestLogTime
                  ? formatDateTime(latestLogTime)
                  : tr("notLoaded", "Not loaded")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {tr("refreshForLatest", "Refresh logs for the latest status")}
              </p>
            </div>
          </section>

          <section className="mb-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Workflow size={22} />
              </div>
              <h2 className="text-lg font-semibold text-slate-950">
                {tr("reassign", "Reassign Approvals")}
              </h2>
              <p className="mb-5 mt-1 text-sm leading-6 text-slate-500">
                {tr(
                  "reassignDescription",
                  "Re-evaluate pending approvals and route them to the currently eligible approvers.",
                )}
              </p>
              <button
                onClick={triggerReassignment}
                disabled={Boolean(activeAction)}
                className={`inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 ${
                  activeAction ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <RefreshCw
                  size={16}
                  className={activeAction === "reassign" ? "animate-spin" : ""}
                />
                {activeAction === "reassign"
                  ? tr("reassigning", "Reassigning...")
                  : tr("runReassignment", "Run reassignment")}
              </button>
              {reassignStats && (
                <div className="mt-3 p-3 border border-blue-200 bg-blue-50 rounded text-sm text-blue-900">
                  {tr(
                    "reassignmentSummary",
                    "Reassigned: {{reassigned}}, Auto-approved: {{autoApproved}}, Failed: {{failed}}.",
                    {
                      reassigned: reassignStats.reassigned ?? 0,
                      autoApproved: reassignStats.autoApproved ?? 0,
                      failed: reassignStats.failed ?? 0,
                    },
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <UserX size={22} />
              </div>
              <h2 className="text-lg font-semibold text-slate-950">
                {tr("deactivateUser", "Deactivate User")}
              </h2>
              <p className="mb-5 mt-1 text-sm leading-6 text-slate-500">
                {tr(
                  "deactivateDescription",
                  "Disable sign-in for a user account. This action is recorded in the audit trail.",
                )}
              </p>
              <label
                htmlFor="deactivate-email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {tr("userEmail", "User email")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="deactivate-email"
                  type="email"
                  value={deactivateEmail}
                  onChange={(e) => setDeactivateEmail(e.target.value)}
                  placeholder={tr("userEmail", "User email")}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                />
                <button
                  onClick={deactivateUser}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  disabled={Boolean(activeAction)}
                >
                  <UserX size={16} />
                  {activeAction === "deactivate"
                    ? tr("deactivating", "Deactivating...")
                    : tr("deactivate", "Deactivate")}
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {tr("viewLogs", "System activity")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {tr(
                      "logsDescription",
                      "Search, filter, and export the latest audit activity.",
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={fetchLogs}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={logLoading}
                  >
                    <RefreshCw
                      size={15}
                      className={logLoading ? "animate-spin" : ""}
                    />
                    {logLoading
                      ? tr("loadingLogs", "Loading Logs...")
                      : tr("refreshLogs", "Refresh logs")}
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={15} />
                    {tr("exportCSV", "CSV")}
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={15} />
                    {tr("exportPDF", "PDF")}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">
                    {tr("searchLogs", "Search logs")}
                  </span>
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    type="text"
                    placeholder={tr("searchLogs", "Search logs...")}
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={filterKeyword}
                    onChange={(e) => setFilterKeyword(e.target.value)}
                  />
                </label>
                <select
                  aria-label={tr("filterByType", "Filter by log type")}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"
                >
                  <option value="all">
                    {tr("allTypes", "All activity types")}
                  </option>
                  {logTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {logLoading && (
              <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
                <RefreshCw className="animate-spin" size={18} />
                {tr("loadingLogs", "Loading Logs...")}
              </div>
            )}

            {!logLoading && currentLogs.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3 font-semibold">
                          {tr("activity", "Activity")}
                        </th>
                        <th className="px-6 py-3 font-semibold">
                          {tr("actor", "Actor")}
                        </th>
                        <th className="px-6 py-3 font-semibold">
                          {tr("reference", "Reference")}
                        </th>
                        <th className="px-6 py-3 font-semibold">
                          {tr("dateTime", "Date & time")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentLogs.map((log, index) => (
                        <tr
                          key={log?.id || index}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getActionTone(log?.action)}`}
                            >
                              {log?.action ||
                                log?.log_type ||
                                tr("logEntry", "Log entry")}
                            </span>
                            {(log?.comments || log?.description) && (
                              <p className="mt-2 max-w-md text-xs text-slate-500">
                                {log.comments || log.description}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-800">
                              {log?.actor_name || tr("systemActor", "System")}
                            </p>
                            {log?.actor_id && (
                              <p className="text-xs text-slate-400">
                                ID {log.actor_id}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {log?.request_id
                              ? `Request #${log.request_id}`
                              : log?.approval_id
                                ? `Approval #${log.approval_id}`
                                : "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                            {formatDateTime(
                              log?.created_at || log?.timestamp,
                            ) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className="border-t border-slate-200 px-6 py-4 justify-between"
                  summary={t("common.pageOf", {
                    current: currentPage,
                    total: totalPages,
                  })}
                  previousLabel={t("common.prev")}
                  nextLabel={t("common.next")}
                />
              </>
            )}

            {!logLoading && hasFetchedLogs && filteredLogs.length === 0 && (
              <div className="flex flex-col items-center p-12 text-center">
                <AlertTriangle className="mb-3 text-slate-300" size={30} />
                <p className="text-sm font-medium text-slate-700">
                  {tr("noLogsFound", "No logs found for the selected filters.")}
                </p>
                <button
                  onClick={() => {
                    setFilterKeyword("");
                    setTypeFilter("all");
                  }}
                  className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  {tr("clearFilters", "Clear filters")}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default AdminTools;