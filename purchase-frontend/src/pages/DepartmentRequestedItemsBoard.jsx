import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  getDepartmentRequestedItems,
  previewDepartmentFollowUpMessage,
  saveDepartmentFollowUpNote,
} from "../api/departmentRequestedItems";

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
    <div className="overflow-x-auto">
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
              <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><button onClick={() => navigate(`/requests/${row.request_id}`)} className="text-blue-600 hover:underline">Open Request</button><button onClick={() => setNoteModal({ open: true, itemIds: [row.item_id] })} className="text-emerald-700 hover:underline">Add Follow-Up</button><button onClick={() => generateMessage([row])} className="text-purple-700 hover:underline">Copy Message</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow">
        <h1 className="text-2xl font-bold">Department Requested Items Board</h1>
        <p className="mt-2 text-blue-100">Consolidated item-level visibility for SCM communication, department follow-up, and open demand monitoring.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[['Open Items', summary.total_open_items], ['Departments With Open Requests', summary.total_departments], ['Overdue Items', summary.overdue_items], ['Emergency Items', summary.emergency_items], ['Partially Procured Items', summary.partially_procured_items]].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">{label}</div><div className="mt-2 text-2xl font-bold text-gray-900">{value ?? 0}</div></div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <select value={filters.department_id} onChange={(e) => updateFilter("department_id", e.target.value)} className="rounded border p-2"><option value="">All Departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value={filters.section_id} onChange={(e) => updateFilter("section_id", e.target.value)} className="rounded border p-2"><option value="">All Sections</option>{activeSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={filters.requester_id} onChange={(e) => updateFilter("requester_id", e.target.value)} className="rounded border p-2"><option value="">All Requesters</option>{requesters.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <label className="sr-only" htmlFor="requested-items-search">Search requested items</label><input id="requested-items-search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search items, requests, departments" className="rounded border p-2" />
          <select value={filters.request_type} onChange={(e) => updateFilter("request_type", e.target.value)} className="rounded border p-2"><option value="">All Request Types</option>{requestTypes.map((v) => <option key={v}>{v}</option>)}</select>
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => fetchRows(1)} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">Refresh</button>
          <button onClick={() => generateMessage()} className="rounded bg-purple-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={actionLoading || !rows.length}>{actionLoading ? "Working..." : "Generate Follow-Up Message"}</button>
          <button onClick={() => setNoteModal({ open: true, itemIds: selectedRows.map((row) => row.item_id) })} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white" disabled={!selectedRows.length}>Add Follow-Up Note</button>
          <button onClick={exportExcel} className="rounded border px-4 py-2 font-semibold text-gray-700" disabled={exporting}>{exporting ? "Exporting..." : "Export Excel (all results)"}</button>
          <button onClick={exportCsv} className="rounded border px-4 py-2 font-semibold text-gray-700">Export CSV (current page)</button>
          {hasActiveFilters && <button onClick={resetFilters} className="rounded border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50">Clear Filters</button>}
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {actionMessage && !error && <div role="status" className="flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"><span>{actionMessage}</span><button onClick={() => setActionMessage("")} aria-label="Dismiss notification" className="font-bold">×</button></div>}
      {loading && <div className="rounded border bg-white p-4 text-gray-600">Loading department requested items...</div>}

      {!loading && selectedRows.length > 0 && <div role="status" aria-label={`${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"} selected`} className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 p-4 text-white shadow-lg"><div><span className="font-bold">{selectedRows.length}</span> item{selectedRows.length === 1 ? "" : "s"} selected{selectedDepartmentCount > 1 && <span className="ml-2 text-xs text-amber-300">Choose one department for follow-up actions</span>}</div><div className="flex flex-wrap gap-2"><button onClick={() => generateMessage(selectedRows)} className="rounded bg-purple-600 px-3 py-2 text-sm font-semibold">Prepare message</button><button onClick={() => setNoteModal({ open: true, itemIds: selectedRows.map((row) => row.item_id) })} disabled={selectedDepartmentCount > 1} title={selectedDepartmentCount > 1 ? "Follow-up notes must be scoped to one department" : ""} className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Add note</button><button onClick={() => setSelectedItems(new Set())} className="rounded border border-slate-500 px-3 py-2 text-sm font-semibold">Clear selection</button></div></div>}

      {!loading && filters.group_by !== "none" && grouped.map((group, index) => (
        <div key={`${group.department_id || group.section_id || index}`} className="rounded-xl border bg-white shadow-sm">
          <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setExpanded((cur) => ({ ...cur, [index]: !cur[index] }))}>
            <div><h2 className="text-lg font-bold text-gray-900">{group.department_name || group.section_name || group.requester_name || group.request_type_name || "Unassigned"}</h2><p className="text-sm text-gray-500">Open: {group.open_items_count} · Overdue: {group.overdue_count} · Emergency: {group.emergency_count} · Partial: {group.partially_procured_count || 0} · Last request: {group.last_request_date ? new Date(group.last_request_date).toLocaleDateString() : "—"}</p></div>
            <span className="text-2xl">{expanded[index] ? "−" : "+"}</span>
          </button>
          {expanded[index] && <div className="border-t">{renderTable(group.items || [])}</div>}
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