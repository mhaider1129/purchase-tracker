import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  createRfxEvent,
  listRfxEvents,
  listRfxResponses,
  analyzeRfxQuotations,
  submitRfxResponse,
  updateRfxStatus,
  awardRfxResponse,
} from "../api/rfxPortal";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../utils/permissions";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const defaultEventForm = {
  title: "",
  rfx_type: "rfq",
  description: "",
  due_date: "",
  request_id: "",
  items: [
    {
      item_name: "",
      specs: "",
      quantity: "",
      notes: "",
    },
  ],
};

const defaultResponseForm = {
  supplier_name: "",
  bid_amount: "",
  notes: "",
  item_responses: [],
};

const createEmptyQuotation = () => ({
  supplier_name: "",
  bid_amount: "",
  safety_score: "",
  value_score: "",
  jci_score: "",
  delivery_score: "",
});

const defaultAnalysisQuotations = [createEmptyQuotation()];

const createEmptyEventItem = () => ({
  item_name: "",
  specs: "",
  quantity: "",
  notes: "",
});

const createResponseItem = (item = {}) => ({
  item_name: item.item_name || "",
  requested_specs: item.specs || "",
  requested_quantity: item.quantity ?? "",
  requested_notes: item.notes || "",
  unit_cost: "",
  quantity: "",
  specs: "",
  brand: "",
  notes: "",
  free_quantity: "",
});

const parseNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const safeParseJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return null;
};

const statusBadge = (status) => {
  const normalized = (status || "").toLowerCase();
  const map = {
    open: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
    awarded: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
    draft: "bg-yellow-100 text-yellow-800",
  };

  return map[normalized] || "bg-blue-100 text-blue-800";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const RfxPortalPage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [responses, setResponses] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [eventForm, setEventForm] = useState(defaultEventForm);
  const [responseForm, setResponseForm] = useState(defaultResponseForm);
  const [analysisQuotations, setAnalysisQuotations] = useState(() => [...defaultAnalysisQuotations]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [awardForm, setAwardForm] = useState({ po_number: "", notes: "" });
  const [awardingResponseId, setAwardingResponseId] = useState(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const canManage = useMemo(
    () => hasPermission(user, "rfx.manage"),
    [user],
  );
  const canRespond = useMemo(
    () =>
      !isAuthenticated ||
      hasPermission(user, "rfx.respond") ||
      user?.role?.toLowerCase?.() === "supplier",
    [isAuthenticated, user],
  );

  const loadEvents = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await listRfxEvents();
      setEvents(data);
    } catch (err) {
      console.error("❌ Failed to load RFX events", err);
      setError(t("rfxPortal.errors.loadEvents"));
    } finally {
      setLoading(false);
    }
  };

  const loadResponses = async (eventId) => {
    if (!eventId || !canManage) {
      setResponses([]);
      return;
    }

    try {
      const data = await listRfxResponses(eventId);
      setResponses(data);
    } catch (err) {
      console.error("❌ Failed to load responses", err);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadResponses(selectedEventId);
    setAnalysisResult(null);
    setAnalysisQuotations([createEmptyQuotation()]);
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEvent) {
      setResponseForm((prev) => ({ ...prev, item_responses: [] }));
      return;
    }

    const eventItems = selectedEvent.details?.items || [];
    const mappedItems = Array.isArray(eventItems)
      ? eventItems.map((item) => createResponseItem(item))
      : [];
    setResponseForm((prev) => ({
      ...prev,
      item_responses: mappedItems,
    }));
  }, [selectedEvent]);

  const handleEventFormChange = (event) => {
    const { name, value } = event.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEventItemChange = (index, field, value) => {
    setEventForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addEventItem = () => {
    setEventForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyEventItem()],
    }));
  };

  const removeEventItem = (index) => {
    setEventForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleResponseFormChange = (event) => {
    const { name, value } = event.target;
    setResponseForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResponseItemChange = (index, field, value) => {
    setResponseForm((prev) => {
      const items = [...(prev.item_responses || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, item_responses: items };
    });
  };

  const handleQuotationChange = (index, field, value) => {
    setAnalysisQuotations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addQuotationRow = () => {
    setAnalysisQuotations((prev) => [...prev, createEmptyQuotation()]);
  };

  const removeQuotationRow = (index) => {
    setAnalysisQuotations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!eventForm.title.trim()) {
      setError(t("rfxPortal.validation.title"));
      return;
    }

    setSavingEvent(true);

    try {
      const normalizedRequestId =
        eventForm.request_id !== "" ? Number(eventForm.request_id) : undefined;
      const trimmedItems = eventForm.items
        .map((item) => ({
          item_name: item.item_name?.trim(),
          specs: item.specs?.trim(),
          quantity: item.quantity === "" ? null : Number(item.quantity),
          notes: item.notes?.trim(),
        }))
        .filter((item) => item.item_name || item.specs || item.quantity || item.notes);
      const payload = {
        ...eventForm,
        rfx_type: eventForm.rfx_type.toLowerCase(),
        request_id: Number.isFinite(normalizedRequestId) ? normalizedRequestId : undefined,
        details: trimmedItems.length ? { items: trimmedItems } : undefined,
      };
      await createRfxEvent(payload);
      setEventForm(defaultEventForm);
      setSuccessMessage(t("rfxPortal.success.eventCreated"));
      await loadEvents();
    } catch (err) {
      console.error("❌ Failed to create RFX event", err);
      setError(err?.response?.data?.message || t("rfxPortal.errors.createEvent"));
    } finally {
      setSavingEvent(false);
    }
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setSavingResponse(true);
    setSuccessMessage("");
    setError("");

    try {
      const totalCost = responseForm.item_responses?.reduce((sum, item) => {
        const qty = parseNumber(item.quantity);
        const unit = parseNumber(item.unit_cost);
        return sum + qty * unit;
      }, 0);
      const totalQuantity = responseForm.item_responses?.reduce(
        (sum, item) => sum + parseNumber(item.quantity),
        0,
      );
      const totalFreeQuantity = responseForm.item_responses?.reduce(
        (sum, item) => sum + parseNumber(item.free_quantity),
        0,
      );
      const payload = {
        ...responseForm,
        bid_amount: responseForm.bid_amount ? Number(responseForm.bid_amount) : undefined,
        response_data: {
          items: responseForm.item_responses || [],
          totals: {
            total_cost: totalCost,
            total_quantity: totalQuantity,
            total_free_quantity: totalFreeQuantity,
          },
        },
      };
      await submitRfxResponse(selectedEventId, payload);
      const eventItems = selectedEvent?.details?.items || [];
      setResponseForm({
        ...defaultResponseForm,
        item_responses: Array.isArray(eventItems) ? eventItems.map((item) => createResponseItem(item)) : [],
      });
      setSuccessMessage(t("rfxPortal.success.responseSubmitted"));
      await loadResponses(selectedEventId);
    } catch (err) {
      console.error("❌ Failed to submit response", err);
      setError(err?.response?.data?.message || t("rfxPortal.errors.submitResponse"));
    } finally {
      setSavingResponse(false);
    }
  };

  const handleAnalyzeQuotations = async (e) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setAnalyzing(true);
    setError("");
    setSuccessMessage("");
    setAnalysisResult(null);

    const filtered = analysisQuotations.filter((quote) =>
      quote.supplier_name?.trim() || quote.bid_amount || quote.safety_score || quote.value_score || quote.jci_score
    );

    if (filtered.length === 0) {
      setError(t("rfxPortal.validation.analysisRequired"));
      setAnalyzing(false);
      return;
    }

    try {
      const result = await analyzeRfxQuotations(selectedEventId, filtered);
      setAnalysisResult(result);
      setSuccessMessage(t("rfxPortal.success.analysisCompleted"));
    } catch (err) {
      console.error("❌ Failed to analyze quotations", err);
      setError(err?.response?.data?.message || t("rfxPortal.errors.analyze"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAwardFieldChange = (event) => {
    const { name, value } = event.target;
    setAwardForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAwardResponse = async (responseId) => {
    if (!selectedEventId || !responseId) return;
    setError("");
    setSuccessMessage("");
    setAwardingResponseId(responseId);

    const payload = {
      response_id: responseId,
      po_number: awardForm.po_number?.trim() || undefined,
      notes: awardForm.notes?.trim() || undefined,
    };

    try {
      await awardRfxResponse(selectedEventId, payload);
      setSuccessMessage(t("rfxPortal.success.awardIssued"));
      setAwardForm({ po_number: "", notes: "" });
      await loadEvents();
      await loadResponses(selectedEventId);
    } catch (err) {
      console.error("❌ Failed to award response", err);
      setError(err?.response?.data?.message || t("rfxPortal.errors.award"));
    } finally {
      setAwardingResponseId(null);
    }
  };

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    setResponses([]);
    setSuccessMessage("");
    setAwardForm({ po_number: "", notes: "" });
  };

  const handleStatusChange = async (eventId, status) => {
    setError("");
    setSuccessMessage("");
    try {
      await updateRfxStatus(eventId, status);
      await loadEvents();
    } catch (err) {
      console.error("❌ Failed to update status", err);
      setError(err?.response?.data?.message || t("rfxPortal.errors.updateStatus"));
    }
  };

  const responseTotals = useMemo(() => {
    const items = responseForm.item_responses || [];
    const totalCost = items.reduce((sum, item) => {
      const qty = parseNumber(item.quantity);
      const unit = parseNumber(item.unit_cost);
      return sum + qty * unit;
    }, 0);
    const totalQuantity = items.reduce((sum, item) => sum + parseNumber(item.quantity), 0);
    const totalFreeQuantity = items.reduce((sum, item) => sum + parseNumber(item.free_quantity), 0);
    return { totalCost, totalQuantity, totalFreeQuantity };
  }, [responseForm.item_responses]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {isAuthenticated ? (
        <Navbar />
      ) : (
        <div className="border-b bg-white/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">
                {t("rfxPortal.publicTag")}
              </p>
              <h1 className="text-lg font-semibold text-gray-900">{t("rfxPortal.title")}</h1>
            </div>
            <Link
              to="/login"
              className="rounded-md border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              {t("rfxPortal.loginCta")}
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("rfxPortal.title")}</h1>
            <p className="text-sm text-gray-600">{t("rfxPortal.subtitle")}</p>
            {!isAuthenticated ? (
              <p className="mt-1 text-sm text-emerald-700">{t("rfxPortal.publicSubtitle")}</p>
            ) : null}
          </div>
          {successMessage ? (
            <span className="rounded bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {successMessage}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {selectedEvent?.request_id ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("rfxPortal.linkedRequest", { id: selectedEvent.request_id })}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-lg font-semibold text-gray-900">{t("rfxPortal.eventList")}</h2>
                <span className="text-sm text-gray-500">
                  {loading ? t("rfxPortal.loading") : t("rfxPortal.eventCount", { count: events.length })}
                </span>
              </div>
              <div className="divide-y">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleSelectEvent(event.id)}
                    className={`w-full text-left transition hover:bg-gray-50 ${
                      selectedEventId === event.id ? "bg-blue-50" : ""
                    }`}
                  >
                        <div className="flex items-start justify-between px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-base font-semibold text-gray-900">{event.title}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(event.status)}`}>
                                {event.status || "open"}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-700">
                                {event.rfx_type}
                              </span>
                              {event.request_id ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                  {t("rfxPortal.requestBadge", { id: event.request_id })}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{event.description || t("rfxPortal.noDescription")}</p>
                            {event.details?.items?.length ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                                  {t("rfxPortal.itemCount", { count: event.details.items.length })}
                                </span>
                              </div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              <span>
                                {t("rfxPortal.dueDate", { date: formatDate(event.due_date) })}
                          </span>
                          <span>•</span>
                          <span>
                            {t("rfxPortal.responseCount", { count: Number(event.response_count || 0) })}
                          </span>
                        </div>
                      </div>
                      {canManage ? (
                        <div className="flex flex-col items-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(event.id, event.status === "open" ? "closed" : "open");
                            }}
                            className="rounded-md bg-gray-100 px-2 py-1 font-medium text-gray-700 hover:bg-gray-200"
                          >
                            {event.status === "open" ? t("rfxPortal.actions.close") : t("rfxPortal.actions.reopen")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}

                {!loading && events.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-600">
                    {t("rfxPortal.empty")}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {canManage ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{t("rfxPortal.publishTitle")}</h3>
                <p className="text-sm text-gray-600">{t("rfxPortal.publishHint")}</p>
                <form className="mt-3 space-y-3" onSubmit={handleCreateEvent}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="title">
                      {t("rfxPortal.fields.title")}
                    </label>
                    <input
                      id="title"
                      name="title"
                      value={eventForm.title}
                      onChange={handleEventFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.title")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="rfx_type">
                      {t("rfxPortal.fields.type")}
                    </label>
                    <select
                      id="rfx_type"
                      name="rfx_type"
                      value={eventForm.rfx_type}
                      onChange={handleEventFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="rfq">RFQ</option>
                      <option value="rfp">RFP</option>
                      <option value="rfi">RFI</option>
                      <option value="itt">ITT</option>
                      <option value="rft">RFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="due_date">
                      {t("rfxPortal.fields.dueDate")}
                    </label>
                    <input
                      type="date"
                      id="due_date"
                      name="due_date"
                      value={eventForm.due_date}
                      onChange={handleEventFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="request_id">
                      {t("rfxPortal.fields.requestIdOptional")}
                    </label>
                    <input
                      id="request_id"
                      name="request_id"
                      type="number"
                      min="1"
                      value={eventForm.request_id}
                      onChange={handleEventFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.requestId")}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {t("rfxPortal.hints.requestId")}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="description">
                      {t("rfxPortal.fields.description")}
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows="3"
                      value={eventForm.description}
                      onChange={handleEventFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.description")}
                    />
                  </div>
                  <div className="space-y-3 rounded-md border border-dashed border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t("rfxPortal.itemsTitle")}</p>
                        <p className="text-xs text-gray-500">{t("rfxPortal.itemsHint")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={addEventItem}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        {t("rfxPortal.actions.addItem")}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {eventForm.items.map((item, index) => (
                        <div key={`event-item-${index}`} className="rounded-md border border-gray-200 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-900">
                              {t("rfxPortal.fields.itemName")} #{index + 1}
                            </p>
                            {eventForm.items.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeEventItem(index)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                {t("rfxPortal.actions.remove")}
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                className="block text-xs font-medium text-gray-700"
                                htmlFor={`event-item-name-${index}`}
                              >
                                {t("rfxPortal.fields.itemName")}
                              </label>
                              <input
                                id={`event-item-name-${index}`}
                                value={item.item_name}
                                onChange={(e) => handleEventItemChange(index, "item_name", e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder={t("rfxPortal.placeholders.itemName")}
                              />
                            </div>
                            <div>
                              <label
                                className="block text-xs font-medium text-gray-700"
                                htmlFor={`event-item-qty-${index}`}
                              >
                                {t("rfxPortal.fields.requestedQty")}
                              </label>
                              <input
                                id={`event-item-qty-${index}`}
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(e) => handleEventItemChange(index, "quantity", e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder={t("rfxPortal.placeholders.quantity")}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-gray-700"
                                htmlFor={`event-item-specs-${index}`}
                              >
                                {t("rfxPortal.fields.specs")}
                              </label>
                              <input
                                id={`event-item-specs-${index}`}
                                value={item.specs}
                                onChange={(e) => handleEventItemChange(index, "specs", e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder={t("rfxPortal.placeholders.specs")}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-gray-700"
                                htmlFor={`event-item-notes-${index}`}
                              >
                                {t("rfxPortal.fields.itemNotes")}
                              </label>
                              <input
                                id={`event-item-notes-${index}`}
                                value={item.notes}
                                onChange={(e) => handleEventItemChange(index, "notes", e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder={t("rfxPortal.placeholders.itemNotes")}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingEvent}
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingEvent ? t("rfxPortal.actions.saving") : t("rfxPortal.actions.publish")}
                  </button>
                </form>
              </div>
            ) : null}

            {selectedEvent && canManage ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t("rfxPortal.analyzeTitle")}</h3>
                    <p className="text-sm text-gray-600">{t("rfxPortal.analyzeHint")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnalysisResult(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {t("rfxPortal.actions.clearAnalysis")}
                  </button>
                </div>
                <form className="mt-3 space-y-4" onSubmit={handleAnalyzeQuotations}>
                  <div className="space-y-3">
                    {analysisQuotations.map((quote, index) => (
                      <div key={`quote-${index}`} className="rounded-md border border-gray-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">
                            {t("rfxPortal.fields.supplierName")} #{index + 1}
                          </p>
                          {analysisQuotations.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeQuotationRow(index)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              {t("rfxPortal.actions.remove")}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700" htmlFor={`quote-supplier-${index}`}>
                              {t("rfxPortal.fields.supplierName")}
                            </label>
                            <input
                              id={`quote-supplier-${index}`}
                              value={quote.supplier_name}
                              onChange={(e) => handleQuotationChange(index, "supplier_name", e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("rfxPortal.placeholders.supplier")}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700" htmlFor={`quote-bid-${index}`}>
                              {t("rfxPortal.fields.bidAmount")}
                            </label>
                            <input
                              id={`quote-bid-${index}`}
                              type="number"
                              step="0.01"
                              value={quote.bid_amount}
                              onChange={(e) => handleQuotationChange(index, "bid_amount", e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("rfxPortal.placeholders.bidAmount")}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700" htmlFor={`quote-safety-${index}`}>
                              {t("rfxPortal.fields.safetyScore")}
                            </label>
                            <input
                              id={`quote-safety-${index}`}
                              type="number"
                              min="0"
                              max="100"
                              value={quote.safety_score}
                              onChange={(e) => handleQuotationChange(index, "safety_score", e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("rfxPortal.placeholders.score")}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700" htmlFor={`quote-value-${index}`}>
                              {t("rfxPortal.fields.valueScore")}
                            </label>
                            <input
                              id={`quote-value-${index}`}
                              type="number"
                              min="0"
                              max="100"
                              value={quote.value_score}
                              onChange={(e) => handleQuotationChange(index, "value_score", e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("rfxPortal.placeholders.score")}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700" htmlFor={`quote-jci-${index}`}>
                              {t("rfxPortal.fields.jciScore")}
                            </label>
                            <input
                              id={`quote-jci-${index}`}
                              type="number"
                              min="0"
                              max="100"
                              value={quote.jci_score}
                              onChange={(e) => handleQuotationChange(index, "jci_score", e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("rfxPortal.placeholders.score")}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700" htmlFor={`quote-delivery-${index}`}>
                              {t("rfxPortal.fields.deliveryScore")}
                            </label>
                            <input
                              id={`quote-delivery-${index}`}
                              type="number"
                              min="0"
                              max="100"
                              value={quote.delivery_score}
                              onChange={(e) => handleQuotationChange(index, "delivery_score", e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={t("rfxPortal.placeholders.score")}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={addQuotationRow}
                      className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                    >
                      {t("rfxPortal.actions.addQuotation")}
                    </button>
                    <button
                      type="submit"
                      disabled={analyzing}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {analyzing ? t("rfxPortal.actions.analyzing") : t("rfxPortal.actions.analyze")}
                    </button>
                  </div>
                </form>

                {analysisResult ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-md bg-emerald-50 p-3 text-emerald-800">
                      <p className="font-semibold">{t("rfxPortal.bestQuotation")}</p>
                      <p className="text-emerald-900">
                        {analysisResult.best_quotation?.supplier_name} — {t("rfxPortal.bestQuotationScore", {
                          score: analysisResult.best_quotation?.composite_score ?? "-",
                        })}
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-md border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">#</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.supplierName")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.bidAmount")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.priceScore")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.valueScore")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.safetyScore")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.jciScore")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.deliveryScore")}</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">{t("rfxPortal.fields.compositeScore")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {analysisResult.rankings?.map((row) => (
                            <tr key={row.rank} className={row.rank === 1 ? "bg-emerald-50" : ""}>
                              <td className="px-3 py-2 font-semibold text-gray-900">{row.rank}</td>
                              <td className="px-3 py-2 text-gray-900">{row.supplier_name}</td>
                              <td className="px-3 py-2 text-gray-700">{row.bid_amount ?? "-"}</td>
                              <td className="px-3 py-2 text-gray-700">{row.price_score ?? "-"}</td>
                              <td className="px-3 py-2 text-gray-700">{row.value_score ?? "-"}</td>
                              <td className="px-3 py-2 text-gray-700">{row.safety_score ?? "-"}</td>
                              <td className="px-3 py-2 text-gray-700">{row.jci_score ?? "-"}</td>
                              <td className="px-3 py-2 text-gray-700">{row.delivery_score ?? "-"}</td>
                              <td className="px-3 py-2 font-semibold text-gray-900">{row.composite_score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedEvent && canRespond ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t("rfxPortal.respondTitle", { title: selectedEvent.title })}
                </h3>
                <p className="text-sm text-gray-600">{t("rfxPortal.respondHint")}</p>
                <form className="mt-3 space-y-3" onSubmit={handleSubmitResponse}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="supplier_name">
                      {t("rfxPortal.fields.supplierName")}
                    </label>
                    <input
                      id="supplier_name"
                      name="supplier_name"
                      value={responseForm.supplier_name}
                      onChange={handleResponseFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.supplier")}
                      required
                    />
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t("rfxPortal.respondItemsTitle")}</p>
                        <p className="text-xs text-gray-500">{t("rfxPortal.respondItemsHint")}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {t("rfxPortal.itemCount", { count: responseForm.item_responses?.length || 0 })}
                      </span>
                    </div>
                    {responseForm.item_responses?.length ? (
                      <div className="mt-3 space-y-4">
                        {responseForm.item_responses.map((item, index) => {
                          const lineTotal = parseNumber(item.quantity) * parseNumber(item.unit_cost);
                          return (
                            <div key={`response-item-${index}`} className="rounded-md border border-gray-100 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                                <p className="text-sm font-semibold text-gray-900">
                                  {item.item_name || t("rfxPortal.fields.itemName")}
                                </p>
                                <span>
                                  {t("rfxPortal.requestedQtyLabel", {
                                    qty: item.requested_quantity || "-",
                                  })}
                                </span>
                              </div>
                              {item.requested_specs ? (
                                <p className="mt-1 text-xs text-gray-500">
                                  {t("rfxPortal.requestedSpecsLabel", { specs: item.requested_specs })}
                                </p>
                              ) : null}
                              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700" htmlFor={`response-unit-${index}`}>
                                    {t("rfxPortal.fields.unitCost")}
                                  </label>
                                  <input
                                    id={`response-unit-${index}`}
                                    type="number"
                                    step="0.01"
                                    value={item.unit_cost}
                                    onChange={(e) => handleResponseItemChange(index, "unit_cost", e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t("rfxPortal.placeholders.unitCost")}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700" htmlFor={`response-qty-${index}`}>
                                    {t("rfxPortal.fields.responseQty")}
                                  </label>
                                  <input
                                    id={`response-qty-${index}`}
                                    type="number"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) => handleResponseItemChange(index, "quantity", e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t("rfxPortal.placeholders.quantity")}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700" htmlFor={`response-free-${index}`}>
                                    {t("rfxPortal.fields.freeQty")}
                                  </label>
                                  <input
                                    id={`response-free-${index}`}
                                    type="number"
                                    min="0"
                                    value={item.free_quantity}
                                    onChange={(e) => handleResponseItemChange(index, "free_quantity", e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t("rfxPortal.placeholders.freeQty")}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700" htmlFor={`response-brand-${index}`}>
                                    {t("rfxPortal.fields.brand")}
                                  </label>
                                  <input
                                    id={`response-brand-${index}`}
                                    value={item.brand}
                                    onChange={(e) => handleResponseItemChange(index, "brand", e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t("rfxPortal.placeholders.brand")}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-gray-700" htmlFor={`response-specs-${index}`}>
                                    {t("rfxPortal.fields.specs")}
                                  </label>
                                  <input
                                    id={`response-specs-${index}`}
                                    value={item.specs}
                                    onChange={(e) => handleResponseItemChange(index, "specs", e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t("rfxPortal.placeholders.specs")}
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <label className="block text-xs font-medium text-gray-700" htmlFor={`response-notes-${index}`}>
                                    {t("rfxPortal.fields.itemNotes")}
                                  </label>
                                  <input
                                    id={`response-notes-${index}`}
                                    value={item.notes}
                                    onChange={(e) => handleResponseItemChange(index, "notes", e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t("rfxPortal.placeholders.itemNotes")}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                {t("rfxPortal.lineTotal", { total: lineTotal.toFixed(2) })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">{t("rfxPortal.itemsEmpty")}</p>
                    )}
                    <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>{t("rfxPortal.totalQuantity", { qty: responseTotals.totalQuantity })}</span>
                        <span>{t("rfxPortal.totalFreeQuantity", { qty: responseTotals.totalFreeQuantity })}</span>
                        <span className="font-semibold text-gray-900">
                          {t("rfxPortal.totalCost", { amount: responseTotals.totalCost.toFixed(2) })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="bid_amount">
                      {t("rfxPortal.fields.bidAmount")}
                    </label>
                    <input
                      id="bid_amount"
                      name="bid_amount"
                      type="number"
                      step="0.01"
                      value={responseForm.bid_amount}
                      onChange={handleResponseFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.bidAmount")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="notes">
                      {t("rfxPortal.fields.notes")}
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows="3"
                      value={responseForm.notes}
                      onChange={handleResponseFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.notes")}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingResponse}
                    className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingResponse ? t("rfxPortal.actions.sending") : t("rfxPortal.actions.submitResponse")}
                  </button>
                </form>
              </div>
            ) : null}

            {selectedEvent && canManage ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{t("rfxPortal.responsesTitle")}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700" htmlFor="po_number">
                      {t("rfxPortal.fields.poNumber")}
                    </label>
                    <input
                      id="po_number"
                      name="po_number"
                      value={awardForm.po_number}
                      onChange={handleAwardFieldChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.poNumber")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700" htmlFor="award_notes">
                      {t("rfxPortal.fields.awardNotes")}
                    </label>
                    <input
                      id="award_notes"
                      name="notes"
                      value={awardForm.notes}
                      onChange={handleAwardFieldChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={t("rfxPortal.placeholders.awardNotes")}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t("rfxPortal.hints.award")}
                </p>
                {responses.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-600">{t("rfxPortal.responsesEmpty")}</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {responses.map((response) => (
                      <div
                        key={response.id}
                        className="rounded-md border border-gray-200 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">{response.supplier_name || t("rfxPortal.fields.supplierName")}</p>
                          <span className="text-xs text-gray-500">{formatDate(response.created_at)}</span>
                        </div>
                        {(() => {
                          const responseData = safeParseJson(response.response_data);
                          const responseItems = responseData?.items || [];
                          const totals = responseData?.totals || {};
                          return responseItems.length ? (
                            <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                              <p className="font-semibold text-gray-700">{t("rfxPortal.itemsSummaryTitle")}</p>
                              <ul className="mt-1 space-y-1">
                                {responseItems.map((item, index) => (
                                  <li key={`response-item-summary-${response.id}-${index}`} className="flex justify-between gap-2">
                                    <span className="truncate">
                                      {item.item_name || t("rfxPortal.fields.itemName")}
                                    </span>
                                    <span>
                                      {t("rfxPortal.summaryQtyCost", {
                                        qty: item.quantity || "-",
                                        amount: item.unit_cost || "-",
                                      })}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                                {totals.total_quantity !== undefined ? (
                                  <span>{t("rfxPortal.totalQuantity", { qty: totals.total_quantity })}</span>
                                ) : null}
                                {totals.total_free_quantity !== undefined ? (
                                  <span>{t("rfxPortal.totalFreeQuantity", { qty: totals.total_free_quantity })}</span>
                                ) : null}
                                {totals.total_cost !== undefined ? (
                                  <span className="font-semibold text-gray-700">
                                    {t("rfxPortal.totalCost", { amount: Number(totals.total_cost).toFixed(2) })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ) : null;
                        })()}
                        <p className="mt-1 text-gray-700">
                          {response.notes || t("rfxPortal.noNotes")}
                        </p>
                        <div className="mt-2 text-xs text-gray-600">
                          {response.bid_amount
                            ? t("rfxPortal.bidLabel", { amount: response.bid_amount })
                            : t("rfxPortal.noBid")}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                          {response.status ? (
                            <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                              {response.status}
                            </span>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            disabled={selectedEvent?.status === "awarded" || awardingResponseId === response.id}
                            onClick={() => handleAwardResponse(response.id)}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {awardingResponseId === response.id
                              ? t("rfxPortal.actions.awarding")
                              : t("rfxPortal.actions.award")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RfxPortalPage;