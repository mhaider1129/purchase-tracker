import React, { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { useTranslation } from "react-i18next";
import apiRequests from "../api/requests";
import Card from "../components/Card";

const defaultItem = {
  item_name: "",
  brand: "",
  quantity: 1,
  unit_cost: "",
  available_quantity: "",
  intended_use: "",
  specs: "",
};

const HistoricalRequestsImportPage = () => {
  const { t } = useTranslation();
  const formatAmount = (value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return "0";
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(num);
  };
  const [form, setForm] = useState({
    request_type: "",
    department_id: "",
    requester_id: "",
    temporary_requester_name: "",
    project_id: "",
    supply_warehouse_id: "",
    justification: "",
    approved_at: "",
    completed_at: "",
    mark_completed: false,
  });
  const [items, setItems] = useState([{ ...defaultItem }]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const totalCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      const unit = Number(item.unit_cost);
      if (!Number.isFinite(quantity) || !Number.isFinite(unit)) return sum;
      return sum + quantity * unit;
    }, 0);
  }, [items]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...defaultItem }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validatePayload = () => {
    if (!form.request_type.trim()) {
      return t("historicalRequests.validation.requestType", "Select a request type");
    }

    if (!String(form.department_id).trim()) {
      return t("historicalRequests.validation.department", "Select a department ID");
    }

    if (!form.requester_id && !form.temporary_requester_name.trim()) {
      return t(
        "historicalRequests.validation.requester",
        "Provide a requester ID or temporary requester name",
      );
    }

    if (!items.length) {
      return t("historicalRequests.validation.items", "Add at least one item");
    }

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.item_name.trim()) {
        return t("historicalRequests.validation.itemName", "Each item needs a name");
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return t("historicalRequests.validation.quantity", "Quantities must be whole numbers");
      }
      if (item.unit_cost !== "" && item.unit_cost !== null) {
        const unitCost = Number(item.unit_cost);
        if (!Number.isInteger(unitCost) || unitCost < 0) {
          return t(
            "historicalRequests.validation.unitCost",
            "Unit cost must be a whole number or left blank",
          );
        }
      }
    }

    if (
      form.request_type === "Warehouse Supply" &&
      !String(form.supply_warehouse_id || "").trim()
    ) {
      return t(
        "historicalRequests.validation.supplyWarehouse",
        "Select the fulfilling warehouse",
      );
    }

    return "";
  };

  const buildPayload = () => {
    const payload = {
      request_type: form.request_type.trim(),
      department_id: Number(form.department_id),
      requester_id: form.requester_id ? Number(form.requester_id) : undefined,
      temporary_requester_name: form.temporary_requester_name.trim() || undefined,
      project_id: form.project_id.trim() || undefined,
      supply_warehouse_id:
        form.request_type === "Warehouse Supply" && form.supply_warehouse_id
          ? Number(form.supply_warehouse_id)
          : undefined,
      justification: form.justification.trim() || undefined,
      approved_at: form.approved_at || undefined,
      completed_at: form.mark_completed ? form.completed_at || undefined : undefined,
      mark_completed: form.mark_completed,
      items: items.map((item) => ({
        ...item,
        item_name: item.item_name.trim(),
        brand: item.brand.trim() || undefined,
        quantity: Number(item.quantity),
        unit_cost:
          item.unit_cost === "" || item.unit_cost === null
            ? undefined
            : Number(item.unit_cost),
        available_quantity:
          item.available_quantity === "" || item.available_quantity === null
            ? undefined
            : Number(item.available_quantity),
        intended_use: item.intended_use.trim() || undefined,
        specs: item.specs.trim() || undefined,
      })),
    };

    if (!payload.requester_id) delete payload.requester_id;
    if (!payload.project_id) delete payload.project_id;
    if (!payload.supply_warehouse_id) delete payload.supply_warehouse_id;
    if (!payload.approved_at) delete payload.approved_at;
    if (!payload.completed_at) delete payload.completed_at;

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validatePayload();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      const res = await apiRequests.createHistoricalRequest(payload);
      setSuccessMessage(
        res?.message ||
          t("historicalRequests.success", "Historical request saved for KPI tracking"),
      );
      setForm({
        request_type: "",
        department_id: "",
        requester_id: "",
        temporary_requester_name: "",
        project_id: "",
        supply_warehouse_id: "",
        justification: "",
        approved_at: "",
        completed_at: "",
        mark_completed: false,
      });
      setItems([{ ...defaultItem }]);
    } catch (err) {
      const fallback = t("historicalRequests.error", "Unable to save historical request");
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
      setErrorMessage(apiMessage || fallback);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-wide text-gray-500">
            {t("historicalRequests.breadcrumb", "Requests / Historical import")}
          </p>
          <h1 className="text-3xl font-semibold text-gray-900">
            {t("historicalRequests.title", "Import historical paper requests")}
          </h1>
          <p className="mt-2 text-gray-600">
            {t(
              "historicalRequests.subtitle",
              "Record previously approved paper requests so KPIs and analytics remain accurate.",
            )}
          </p>
        </div>

        {(errorMessage || successMessage) && (
          <div
            className={`mb-6 rounded border p-4 ${
              errorMessage
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {errorMessage || successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.requestType", "Request type")}
                  </label>
                  <select
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    value={form.request_type}
                    onChange={(e) => handleFieldChange("request_type", e.target.value)}
                  >
                    <option value="">
                      {t("historicalRequests.placeholders.selectType", "Select type")}
                    </option>
                    <option value="Stock">Stock</option>
                    <option value="Non Stock">Non Stock</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Medical Device">Medical Device</option>
                    <option value="Medication">Medication</option>
                    <option value="Warehouse Supply">Warehouse Supply</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.departmentId", "Department ID")}
                  </label>
                  <input
                    type="number"
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    value={form.department_id}
                    onChange={(e) => handleFieldChange("department_id", e.target.value)}
                    placeholder="123"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.requesterId", "Requester ID")}
                  </label>
                  <input
                    type="number"
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    value={form.requester_id}
                    onChange={(e) => handleFieldChange("requester_id", e.target.value)}
                    placeholder={t(
                      "historicalRequests.placeholders.requesterId",
                      "Employee ID for the requester",
                    )}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t(
                      "historicalRequests.help.requester",
                      "Required unless you provide a temporary requester name.",
                    )}
                  </p>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.temporaryRequester", "Temporary requester name")}
                  </label>
                  <input
                    type="text"
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    value={form.temporary_requester_name}
                    onChange={(e) =>
                      handleFieldChange("temporary_requester_name", e.target.value)
                    }
                    placeholder={t(
                      "historicalRequests.placeholders.temporaryRequester",
                      "Name on the paper request",
                    )}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.projectId", "Project ID (optional)")}
                  </label>
                  <input
                    type="text"
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    value={form.project_id}
                    onChange={(e) => handleFieldChange("project_id", e.target.value)}
                    placeholder="uuid-1234"
                  />
                </div>

                {form.request_type === "Warehouse Supply" && (
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700">
                      {t(
                        "historicalRequests.fields.supplyWarehouse",
                        "Supply warehouse ID",
                      )}
                    </label>
                    <input
                      type="number"
                      className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                      value={form.supply_warehouse_id}
                      onChange={(e) =>
                        handleFieldChange("supply_warehouse_id", e.target.value)
                      }
                      placeholder="Warehouse ID"
                    />
                  </div>
                )}

                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.justification", "Justification (optional)")}
                  </label>
                  <textarea
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    rows={3}
                    value={form.justification}
                    onChange={(e) => handleFieldChange("justification", e.target.value)}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-700">
                    {t("historicalRequests.fields.approvedAt", "Approved on")}
                  </label>
                  <input
                    type="date"
                    className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    value={form.approved_at}
                    onChange={(e) => handleFieldChange("approved_at", e.target.value)}
                  />
                </div>

                <div className="flex flex-col rounded border border-gray-200 bg-gray-50 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.mark_completed}
                      onChange={(e) => handleFieldChange("mark_completed", e.target.checked)}
                    />
                    {t("historicalRequests.fields.markCompleted", "Mark as completed")}
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    {t(
                      "historicalRequests.help.completion",
                      "If checked, the request will be stored as Completed and ready for KPI tracking.",
                    )}
                  </p>
                  {form.mark_completed && (
                    <input
                      type="date"
                      className="mt-3 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                      value={form.completed_at}
                      onChange={(e) => handleFieldChange("completed_at", e.target.value)}
                    />
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {t("historicalRequests.items.title", "Requested items")}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {t(
                        "historicalRequests.items.subtitle",
                        "Use whole numbers for quantity and unit cost to match paper forms.",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {t("historicalRequests.items.add", "Add item")}
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-800">
                          {t("historicalRequests.items.label", "Item")} #{idx + 1}
                        </h3>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            {t("historicalRequests.items.remove", "Remove")}
                          </button>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">
                            {t("historicalRequests.items.fields.name", "Item name")}
                          </label>
                          <input
                            type="text"
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            value={item.item_name}
                            onChange={(e) => handleItemChange(idx, "item_name", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">
                            {t("historicalRequests.items.fields.brand", "Brand (optional)")}
                          </label>
                          <input
                            type="text"
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            value={item.brand}
                            onChange={(e) => handleItemChange(idx, "brand", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">
                            {t("historicalRequests.items.fields.quantity", "Quantity")}
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">
                            {t("historicalRequests.items.fields.unitCost", "Unit cost (optional)")}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            value={item.unit_cost}
                            onChange={(e) => handleItemChange(idx, "unit_cost", e.target.value)}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {t(
                              "historicalRequests.items.fields.unitCostHelp",
                              "Leave blank if the paper form omitted pricing.",
                            )}
                          </p>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">
                            {t(
                              "historicalRequests.items.fields.availableQuantity",
                              "Available quantity (optional)",
                            )}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            value={item.available_quantity}
                            onChange={(e) =>
                              handleItemChange(idx, "available_quantity", e.target.value)
                            }
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">
                            {t("historicalRequests.items.fields.intendedUse", "Intended use (optional)")}
                          </label>
                          <input
                            type="text"
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            value={item.intended_use}
                            onChange={(e) => handleItemChange(idx, "intended_use", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col md:col-span-2">
                          <label className="text-sm font-semibold text-gray-700">
                            {t("historicalRequests.items.fields.specs", "Specs (optional)")}
                          </label>
                          <textarea
                            className="mt-1 rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            rows={2}
                            value={item.specs}
                            onChange={(e) => handleItemChange(idx, "specs", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {t("historicalRequests.summary.total", "Estimated total")}: {" "}
                    <span className="font-semibold text-gray-900">
                      {formatAmount(Number.isFinite(totalCost) ? totalCost : 0)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {t(
                      "historicalRequests.summary.note",
                      "Totals are calculated from item quantities and unit costs.",
                    )}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? t("historicalRequests.actions.saving", "Saving…")
                    : t("historicalRequests.actions.save", "Import historical request")}
                </button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            <Card>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("historicalRequests.help.title", "Import guidance")}
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                <li>
                  {t(
                    "historicalRequests.help.items",
                    "Use one line per requested item. Quantities and costs must be whole numbers.",
                  )}
                </li>
                <li>
                  {t(
                    "historicalRequests.help.dates",
                    "Set the approved date to match the original paper approval. Completion date is optional.",
                  )}
                </li>
                <li>
                  {t(
                    "historicalRequests.help.access",
                    "Only authorized users can import requests for KPI alignment.",
                  )}
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HistoricalRequestsImportPage;