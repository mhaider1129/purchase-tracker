import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  getDepartmentRequestedItems,
  previewDepartmentFollowUpMessage,
  saveDepartmentFollowUpNote,
} from "../api/departmentRequestedItems";
import ProcurementPageHeader from "../components/layout/ProcurementPageHeader";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  MessageSquareText,
  PackageOpen,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";

const emptyFilters = {
  department_id: "",
  section_id: "",
  requester_id: "",
  request_type: "",
  approval_status: "",
  procurement_status: "",
  date_from: "",
  date_to: "",
  search: "",
  emergency_only: false,
  overdue_only: false,
  include_completed: false,
  group_by: "department",
  sort_by: "",
  sort_dir: "asc",
};

const requestTypes = ["Stock", "Non-Stock", "Medical Device", "Medication", "IT Item", "Maintenance", "Warehouse Supply", "Printing Logbook"];
const approvalStatuses = ["Pending", "Approved", "Rejected"];
const procurementStatuses = ["pending", "partially procured", "Fully Procured", "received"];

const Badge = ({ children, className = "" }) => (
  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{children}</span>
);

const sortableColumns = {
  request_date: "Request date",
  item_name: "Item",
  remaining_quantity: "Remaining",
  procurement_status: "Status",
  required_delivery_date: "Required date",
  days_since_request: "Age",
};

const toCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const excelColumns = [
  ["request_id", "Request ID"],
  ["request_number", "Request Number"],
  ["request_date", "Request Date"],
  ["submission_timeline", "Submission Timeline"],
  ["request_type", "Request Type"],
  ["request_status", "Request Status"],
  ["approval_status", "Approval Status"],
  ["approval_started_at", "Approval Started At"],
  ["first_approval_at", "First Approval At"],
  ["final_approval_at", "Final Approval At"],
  ["approval_duration_days", "Approval Duration (Days)"],
  ["approval_timeline", "Approval Timeline"],
  ["department_name", "Department"],
  ["section_name", "Section"],
  ["requester_name", "Requester"],
  ["requester_phone", "Requester Phone"],
  ["requester_email", "Requester Email"],
  ["item_id", "Item ID"],
  ["item_name", "Item"],
  ["brand", "Brand"],
  ["specs", "Specs"],
  ["intended_use", "Intended Use"],
  ["requested_quantity", "Requested Quantity"],
  ["purchased_quantity", "Purchased Quantity"],
  ["remaining_quantity", "Remaining Quantity"],
  ["procurement_status", "Procurement Status"],
  ["assigned_to_name", "Assigned To"],
  ["required_delivery_date", "Required Delivery Date"],
  ["priority", "Priority"],
  ["emergency_flag", "Emergency"],
  ["overdue_flag", "Overdue"],
  ["partially_procured_flag", "Partially Procured"],
  ["justification", "Justification"],
  ["last_procurement_update", "Last Procurement Update"],
  ["latest_procurement_event", "Latest Procurement Event"],
  ["latest_follow_up_note", "Latest Follow-Up Note"],
  ["latest_department_response", "Latest Department Response"],
  ["days_since_request", "Days Since Request"],
];

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const DepartmentRequestedItemsBoard = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters);
  const [searchInput, setSearchInput] = useState("");
  const [departments, setDepartments] = useState([]);
  const [requesters, setRequesters] = useState([]);
  const [rows, setRows] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, total_pages: 0 });
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [messagePreview, setMessagePreview] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [noteModal, setNoteModal] = useState({ open: false, itemIds: [] });
  const [noteForm, setNoteForm] = useState({ note: "", department_response: "", next_follow_up_date: "" });
  const requestSequence = useRef(0);
  const pageLimit = useRef(100);

  const selectedRows = useMemo(() => rows.filter((row) => selectedItems.has(row.item_id)), [rows, selectedItems]);
  const selectedDepartmentCount = useMemo(() => new Set(selectedRows.map((row) => row.department_id)).size, [selectedRows]);

  useEffect(() => {
    api.get("/departments").then((res) => setDepartments(res.data || [])).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    const departmentId = filters.department_id;
    if (!departmentId) {
      setRequesters([]);
      return;
    }
    api.get(`/departments/${departmentId}/requesters`, { params: { section_id: filters.section_id || undefined } })
      .then((res) => setRequesters(res.data || []))
      .catch(() => setRequesters([]));
  }, [filters.department_id, filters.section_id]);

  const fetchRows = useCallback(async (page = 1, limit = pageLimit.current) => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError("");
    try {
      const params = {
        ...filters,
        page,
        limit,
        emergency_only: filters.emergency_only || undefined,
        overdue_only: filters.overdue_only || undefined,
        include_completed: filters.include_completed || undefined,
      };
      Object.keys(params).forEach((key) => (params[key] === "" || params[key] === false) && delete params[key]);
      const response = await getDepartmentRequestedItems(params);
      if (requestId !== requestSequence.current) return;
      setRows(response.data || []);
      setGrouped(response.grouped || []);
      setSummary(response.summary || {});
      setPagination(response.pagination || { page, limit, total: 0, total_pages: 0 });
      pageLimit.current = response.pagination?.limit || limit;
      setExpanded((response.grouped || []).reduce((acc, group, index) => ({ ...acc, [index]: index < 3 }), {}));
      setSelectedItems(new Set());
    } catch (err) {
      if (requestId === requestSequence.current) setError(err.response?.data?.message || "Failed to load department requested items.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => current.search === searchInput ? current : { ...current, search: searchInput });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchRows(1);
  }, [filters, fetchRows]);

  const activeSections = useMemo(() => {
    if (!filters.department_id) return departments.flatMap((department) => department.sections || []);
    return departments.find((department) => String(department.id) === String(filters.department_id))?.sections || [];
  }, [departments, filters.department_id]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "department_id" ? { section_id: "", requester_id: "" } : {}), ...(key === "section_id" ? { requester_id: "" } : {}) }));
  };

  const toggleSelected = (itemId) => {
    setSelectedItems((current) => {
      const next = new Set(current);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const generateMessage = async (scopeRows = selectedRows.length ? selectedRows : rows) => {
    if (!scopeRows.length) return;
    const departmentRows = scopeRows.filter((row) => row.department_id === scopeRows[0].department_id);
    if (departmentRows.length !== scopeRows.length) {
      setError("Follow-up messages can only include items from one department. Select a single department and try again.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const response = await previewDepartmentFollowUpMessage({ department_id: departmentRows[0].department_id, item_ids: departmentRows.map((row) => row.item_id), message_type: "whatsapp" });
      setMessagePreview(response.message || "");
      setActionMessage(`Follow-up message prepared for ${departmentRows.length} item${departmentRows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to prepare the follow-up message.");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchAllRowsForExport = async () => {
    const pageSize = 250;
    const firstParams = {
      ...filters,
      page: 1,
      limit: pageSize,
      group_by: "none",
      emergency_only: filters.emergency_only || undefined,
      overdue_only: filters.overdue_only || undefined,
      include_completed: filters.include_completed || undefined,
    };
    Object.keys(firstParams).forEach((key) => (firstParams[key] === "" || firstParams[key] === false) && delete firstParams[key]);
    const firstResponse = await getDepartmentRequestedItems(firstParams);
    const allRows = [...(firstResponse.data || [])];
    const totalPages = firstResponse.pagination?.total_pages || 1;

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await getDepartmentRequestedItems({ ...firstParams, page });
      allRows.push(...(response.data || []));
    }

    return allRows;
  };

  const exportExcel = async () => {
    setExporting(true);
    setError("");
    try {
      const exportRows = await fetchAllRowsForExport();
      const headerHtml = excelColumns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("");
      const rowsHtml = exportRows
        .map((row) => `<tr>${excelColumns.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`)
        .join("");
      const workbook = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
      const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "department-requested-items.xls";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export department requested items.");
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    const body = rows.map((row) => excelColumns.map(([key]) => toCsvValue(row[key])).join(","));
    const blob = new Blob([[excelColumns.map(([, label]) => toCsvValue(label)).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "department-requested-items-current-page.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const saveNote = async () => {
    const scopeRows = noteModal.itemIds.length ? rows.filter((row) => noteModal.itemIds.includes(row.item_id)) : selectedRows;
    if (!scopeRows.length) return;
    if (new Set(scopeRows.map((row) => row.department_id)).size > 1) {
      setError("Follow-up notes can only include items from one department. Select a single department and try again.");
      setNoteModal({ open: false, itemIds: [] });
      return;
    }
    if (!noteForm.note.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      await saveDepartmentFollowUpNote({
        item_ids: scopeRows.map((row) => row.item_id),
        department_id: scopeRows[0].department_id,
        note: noteForm.note,
        department_response: noteForm.department_response,
        next_follow_up_date: noteForm.next_follow_up_date || null,
      });
      setNoteModal({ open: false, itemIds: [] });
      setNoteForm({ note: "", department_response: "", next_follow_up_date: "" });
      setActionMessage(`Follow-up note saved for ${scopeRows.length} item${scopeRows.length === 1 ? "" : "s"}.`);
      fetchRows(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the follow-up note.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAll = (tableRows, checked) => {
    setSelectedItems((current) => {
      const next = new Set(current);
      tableRows.forEach((row) => checked ? next.add(row.item_id) : next.delete(row.item_id));
      return next;
    });
  };

  const setSort = (sortBy) => {
    setFilters((current) => ({
      ...current,
      sort_by: sortBy,
      sort_dir: current.sort_by === sortBy && current.sort_dir === "asc" ? "desc" : "asc",
    }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(emptyFilters);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    !["group_by", "sort_by", "sort_dir"].includes(key) && value !== emptyFilters[key]
  );

  const renderStatus = (row) => (
    <div className="flex flex-wrap gap-1">
      <Badge className="bg-slate-100 text-slate-700">{row.procurement_status || "pending"}</Badge>
      {row.emergency_flag && <Badge className="bg-red-100 text-red-700">Emergency</Badge>}
      {row.overdue_flag && <Badge className="bg-amber-100 text-amber-800">Overdue</Badge>}
      {row.partially_procured_flag && <Badge className="bg-blue-100 text-blue-700">Partial</Badge>}
    </div>
  );

  const renderTable = (tableRows) => (
    <div className="workspace-results overflow-x-auto border-0 shadow-none">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2"><span className="sr-only">Select items</span><input aria-label="Select all items in this table" type="checkbox" checked={tableRows.length > 0 && tableRows.every((row) => selectedItems.has(row.item_id))} onChange={(e) => toggleAll(tableRows, e.target.checked)} /></th><th className="px-3 py-2">Request ID</th><th className="px-3 py-2">Section</th><th className="px-3 py-2">Requester</th><th className="px-3 py-2"><button onClick={() => setSort("item_name")} className="font-semibold hover:text-blue-700">Item {filters.sort_by === "item_name" ? (filters.sort_dir === "asc" ? "↑" : "↓") : ""}</button></th><th className="px-3 py-2">Specs</th><th className="px-3 py-2">Requested</th><th className="px-3 py-2">Purchased</th><th className="px-3 py-2"><button onClick={() => setSort("remaining_quantity")} className="font-semibold hover:text-blue-700">Remaining {filters.sort_by === "remaining_quantity" ? (filters.sort_dir === "asc" ? "↑" : "↓") : ""}</button></th><th className="px-3 py-2"><button onClick={() => setSort("procurement_status")} className="font-semibold hover:text-blue-700">Status {filters.sort_by === "procurement_status" ? (filters.sort_dir === "asc" ? "↑" : "↓") : ""}</button></th><th className="px-3 py-2">Required Date</th><th className="px-3 py-2"><button onClick={() => setSort("days_since_request")} className="font-semibold hover:text-blue-700">Age {filters.sort_by === "days_since_request" ? (filters.sort_dir === "asc" ? "↑" : "↓") : ""}</button></th><th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {tableRows.map((row) => (
            <tr key={row.item_id} className={`${row.overdue_flag ? "bg-amber-50" : ""} ${row.emergency_flag ? "ring-1 ring-red-100" : ""}`}>
              <td className="px-3 py-2"><input aria-label={`Select ${row.item_name}`} type="checkbox" checked={selectedItems.has(row.item_id)} onChange={() => toggleSelected(row.item_id)} /></td>
              <td className="px-3 py-2 font-semibold text-blue-700">#{row.request_number || row.request_id}</td>
              <td className="px-3 py-2">{row.section_name || "—"}</td>
              <td className="px-3 py-2"><div>{row.requester_name || "—"}</div><div className="text-xs text-gray-500">{row.requester_phone || row.requester_email}</div></td>
              <td className="px-3 py-2"><div className="font-medium">{row.item_name}</div><div className="text-xs text-gray-500">{row.brand || row.intended_use || ""}</div></td>
              <td className="px-3 py-2 max-w-xs whitespace-pre-wrap text-gray-700">{row.specs || "—"}</td>
              <td className="px-3 py-2">{row.requested_quantity}</td>
              <td className="px-3 py-2">{row.purchased_quantity}</td>
              <td className="px-3 py-2 font-bold text-red-700">{row.remaining_quantity}</td>
              <td className="px-3 py-2">{renderStatus(row)}</td>
              <td className="px-3 py-2">{row.required_delivery_date || "—"}</td>
              <td className="px-3 py-2">{row.days_since_request}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-1.5"><button onClick={() => navigate(`/requests/${row.request_id}`)} className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Open Request</button><button onClick={() => setNoteModal({ open: true, itemIds: [row.item_id] })} className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Add Follow-Up</button><button onClick={() => generateMessage([row])} className="rounded-md bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">Copy Message</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="procurement-workspace mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <ProcurementPageHeader
        title="Department Requested Items Board"
        eyebrow="Demand coordination"
        icon={ClipboardList}
        description="Consolidated item-level visibility for SCM communication, department follow-up, and open demand monitoring."
        actions={(
          <button
            type="button"
            onClick={() => fetchRows(1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            {loading ? "Refreshing…" : "Refresh data"}
          </button>
        )}
      />

      <div className="workspace-kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Open Items', value: summary.total_open_items, icon: PackageOpen, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Departments With Open Requests', value: summary.total_departments, icon: Building2, tone: 'bg-indigo-50 text-indigo-700' },
          { label: 'Overdue Items', value: summary.overdue_items, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Emergency Items', value: summary.emergency_items, icon: AlertTriangle, tone: 'bg-red-50 text-red-700' },
          { label: 'Partially Procured Items', value: summary.partially_procured_items, icon: ClipboardList, tone: 'bg-violet-50 text-violet-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold text-slate-900">{value ?? 0}</div></div>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
          </div>
        ))}
      </div>

      <section className="workspace-filter-panel">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Filter className="h-5 w-5" aria-hidden="true" /></span>
          <div><h2 className="font-semibold text-slate-900">Find requested items</h2><p className="text-sm text-slate-500">Filter demand by ownership, workflow status, dates, or urgency.</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <select value={filters.department_id} onChange={(e) => updateFilter("department_id", e.target.value)} className="rounded border p-2"><option value="">All Departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value={filters.section_id} onChange={(e) => updateFilter("section_id", e.target.value)} className="rounded border p-2"><option value="">All Sections</option>{activeSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={filters.requester_id} onChange={(e) => updateFilter("requester_id", e.target.value)} className="rounded border p-2"><option value="">All Requesters</option>{requesters.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input aria-label="Search requested items" value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search items, requests, departments" className="w-full rounded border py-2 pl-9 pr-3" /></div>          <select value={filters.request_type} onChange={(e) => updateFilter("request_type", e.target.value)} className="rounded border p-2"><option value="">All Request Types</option>{requestTypes.map((v) => <option key={v}>{v}</option>)}</select>
          <select value={filters.approval_status} onChange={(e) => updateFilter("approval_status", e.target.value)} className="rounded border p-2"><option value="">Approval Status</option>{approvalStatuses.map((v) => <option key={v}>{v}</option>)}</select>
          <select value={filters.procurement_status} onChange={(e) => updateFilter("procurement_status", e.target.value)} className="rounded border p-2"><option value="">Procurement Status</option>{procurementStatuses.map((v) => <option key={v}>{v}</option>)}</select>
          <select value={filters.group_by} onChange={(e) => updateFilter("group_by", e.target.value)} className="rounded border p-2"><option value="department">Grouped by Department</option><option value="section">Grouped by Section</option><option value="none">Flat Table</option></select>
          <select value={filters.sort_by} onChange={(e) => updateFilter("sort_by", e.target.value)} className="rounded border p-2" aria-label="Sort requested items"><option value="">Default sorting</option>{Object.entries(sortableColumns).map(([value, label]) => <option key={value} value={value}>Sort by {label}</option>)}</select>
          <select value={filters.sort_dir} onChange={(e) => updateFilter("sort_dir", e.target.value)} className="rounded border p-2" aria-label="Sort direction" disabled={!filters.sort_by}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
          <input type="date" value={filters.date_from} onChange={(e) => updateFilter("date_from", e.target.value)} className="rounded border p-2" />
          <input type="date" value={filters.date_to} onChange={(e) => updateFilter("date_to", e.target.value)} className="rounded border p-2" />
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.emergency_only} onChange={(e) => updateFilter("emergency_only", e.target.checked)} /> Emergency Only</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.overdue_only} onChange={(e) => updateFilter("overdue_only", e.target.checked)} /> Overdue Only</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.include_completed} onChange={(e) => updateFilter("include_completed", e.target.checked)} /> Include Completed</label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button onClick={() => generateMessage()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"><MessageSquareText className="h-4 w-4" aria-hidden="true" />Generate Follow-Up</button>
          <button onClick={() => setNoteModal({ open: true, itemIds: selectedRows.map((row) => row.item_id) })} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedRows.length}><Send className="h-4 w-4" aria-hidden="true" />Add Follow-Up Note</button>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={exporting}><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />{exporting ? "Exporting..." : "Excel · all results"}</button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" aria-hidden="true" />CSV · current page</button>
          </div>
        </div>
      </section>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {actionMessage && !error && <div role="status" className="flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"><span>{actionMessage}</span><button onClick={() => setActionMessage("")} aria-label="Dismiss notification" className="font-bold">×</button></div>}
      {loading && <div className="rounded border bg-white p-4 text-gray-600">Loading department requested items...</div>}

      {!loading && selectedRows.length > 0 && <div role="status" aria-label={`${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"} selected`} className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 p-4 text-white shadow-lg"><div><span className="font-bold">{selectedRows.length}</span> item{selectedRows.length === 1 ? "" : "s"} selected{selectedDepartmentCount > 1 && <span className="ml-2 text-xs text-amber-300">Choose one department for follow-up actions</span>}</div><div className="flex flex-wrap gap-2"><button onClick={() => generateMessage(selectedRows)} className="rounded bg-purple-600 px-3 py-2 text-sm font-semibold">Prepare message</button><button onClick={() => setNoteModal({ open: true, itemIds: selectedRows.map((row) => row.item_id) })} disabled={selectedDepartmentCount > 1} title={selectedDepartmentCount > 1 ? "Follow-up notes must be scoped to one department" : ""} className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Add note</button><button onClick={() => setSelectedItems(new Set())} className="rounded border border-slate-500 px-3 py-2 text-sm font-semibold">Clear selection</button></div></div>}

      {!loading && filters.group_by !== "none" && grouped.map((group, index) => (
        <div key={`${group.department_id || group.section_id || index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
          <button className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-slate-50" onClick={() => setExpanded((cur) => ({ ...cur, [index]: !cur[index] }))}>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{group.department_name || group.section_name || group.requester_name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{group.open_items_count} open</span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{group.overdue_count} overdue</span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{group.emergency_count} emergency</span>
                <span className="px-1 py-1 font-medium text-slate-500">Last request {group.last_request_date ? new Date(group.last_request_date).toLocaleDateString() : "—"}</span>
              </div>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xl font-medium text-slate-600">{expanded[index] ? "−" : "+"}</span>
          </button>
          {expanded[index] && <div className="border-t border-slate-200">{renderTable(group.items || [])}</div>}
        </div>
      ))}

      {!loading && filters.group_by === "none" && <div className="rounded-xl border bg-white shadow-sm">{renderTable(rows)}</div>}

      {!loading && rows.length === 0 && !error && <div className="rounded-xl border border-dashed bg-white p-10 text-center shadow-sm"><div className="text-lg font-semibold text-gray-800">No requested items found</div><p className="mt-1 text-sm text-gray-500">Try changing the filters or include completed items.</p>{hasActiveFilters && <button onClick={resetFilters} className="mt-4 rounded bg-blue-700 px-4 py-2 font-semibold text-white">Clear Filters</button>}</div>}

      {!loading && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 text-sm text-gray-700 shadow-sm">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} items
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pagination.limit}
                onChange={(e) => {
                  const nextLimit = Number(e.target.value);
                  pageLimit.current = nextLimit;
                  setPagination((current) => ({ ...current, limit: nextLimit, page: 1 }));
                  fetchRows(1, nextLimit);
                }}
                className="rounded border p-2"
              >
                {[50, 100, 250].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button onClick={() => fetchRows(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
            <span>Page {pagination.page} of {pagination.total_pages || 1}</span>
            <button onClick={() => fetchRows(Math.min(pagination.total_pages || 1, pagination.page + 1))} disabled={pagination.page >= (pagination.total_pages || 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {messagePreview && <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="mb-2 font-semibold">Follow-Up Message Preview</div><textarea readOnly value={messagePreview} className="h-48 w-full rounded border p-3" /><button onClick={() => navigator.clipboard?.writeText(messagePreview)} className="mt-2 rounded bg-purple-700 px-4 py-2 font-semibold text-white">Copy Message</button></div>}

      {noteModal.open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">Add Follow-Up Note</h2><textarea value={noteForm.note} onChange={(e) => setNoteForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note" className="mt-4 h-28 w-full rounded border p-3" /><input value={noteForm.department_response} onChange={(e) => setNoteForm((f) => ({ ...f, department_response: e.target.value }))} placeholder="Department response" className="mt-3 w-full rounded border p-3" /><input type="date" value={noteForm.next_follow_up_date} onChange={(e) => setNoteForm((f) => ({ ...f, next_follow_up_date: e.target.value }))} className="mt-3 w-full rounded border p-3" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setNoteModal({ open: false, itemIds: [] })} className="rounded border px-4 py-2">Cancel</button><button onClick={saveNote} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white">Save Note</button></div></div></div>}
    </div>
  );
};

export default DepartmentRequestedItemsBoard;