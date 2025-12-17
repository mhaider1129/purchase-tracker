import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  createRfxEvent,
  listRfxEvents,
  listRfxResponses,
  submitRfxResponse,
  updateRfxStatus,
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
};

const defaultResponseForm = {
  supplier_name: "",
  bid_amount: "",
  notes: "",
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
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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
  }, [selectedEventId]);

  const handleEventFormChange = (event) => {
    const { name, value } = event.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResponseFormChange = (event) => {
    const { name, value } = event.target;
    setResponseForm((prev) => ({ ...prev, [name]: value }));
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
      const payload = {
        ...eventForm,
        rfx_type: eventForm.rfx_type.toLowerCase(),
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
      const payload = {
        ...responseForm,
        bid_amount: responseForm.bid_amount ? Number(responseForm.bid_amount) : undefined,
      };
      await submitRfxResponse(selectedEventId, payload);
      setResponseForm(defaultResponseForm);
      setSuccessMessage(t("rfxPortal.success.responseSubmitted"));
      await loadResponses(selectedEventId);
    } catch (err) {
      console.error("❌ Failed to submit response", err);
      setError(err?.response?.data?.message || t("rfxPortal.errors.submitResponse"));
    } finally {
      setSavingResponse(false);
    }
  };

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    setResponses([]);
    setSuccessMessage("");
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

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

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
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{event.description || t("rfxPortal.noDescription")}</p>
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
                        <p className="mt-1 text-gray-700">
                          {response.notes || t("rfxPortal.noNotes")}
                        </p>
                        <div className="mt-2 text-xs text-gray-600">
                          {response.bid_amount
                            ? t("rfxPortal.bidLabel", { amount: response.bid_amount })
                            : t("rfxPortal.noBid")}
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