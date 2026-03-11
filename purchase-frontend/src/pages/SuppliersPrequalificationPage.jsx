import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar";
import { listSuppliers } from "../api/suppliers";

const STATUS_OPTIONS = [
  { value: "not_started", labelKey: "suppliersPrequalification.status.notStarted" },
  { value: "in_review", labelKey: "suppliersPrequalification.status.inReview" },
  { value: "prequalified", labelKey: "suppliersPrequalification.status.prequalified" },
  { value: "on_hold", labelKey: "suppliersPrequalification.status.onHold" },
  { value: "rejected", labelKey: "suppliersPrequalification.status.rejected" },
];

const RISK_OPTIONS = [
  { value: "low", labelKey: "suppliersPrequalification.risk.low" },
  { value: "medium", labelKey: "suppliersPrequalification.risk.medium" },
  { value: "high", labelKey: "suppliersPrequalification.risk.high" },
];

const SuppliersPrequalificationPage = () => {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [prequalifications, setPrequalifications] = useState([]);
  const [formValues, setFormValues] = useState({
    supplierId: "",
    status: "not_started",
    riskTier: "medium",
    prequalifiedOn: "",
    expiresOn: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await listSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to load suppliers:", err);
      setError(t("suppliersPrequalification.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const prequalificationBySupplier = useMemo(() => {
    const map = new Map();
    prequalifications.forEach((entry) => {
      if (entry.supplierId) {
        map.set(entry.supplierId, entry);
      }
    });
    return map;
  }, [prequalifications]);

  const supplierOptions = useMemo(
    () =>
      suppliers
        .map((supplier) => ({
          id: String(supplier.id),
          name: supplier.name || "-",
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return supplierOptions;
    return supplierOptions.filter((supplier) =>
      supplier.name.toLowerCase().includes(term),
    );
  }, [search, supplierOptions]);

  const statusCounts = useMemo(() => {
    const totals = {
      total: suppliers.length,
      prequalified: 0,
      inReview: 0,
      onHold: 0,
      rejected: 0,
    };

    prequalifications.forEach((entry) => {
      if (entry.status === "prequalified") totals.prequalified += 1;
      if (entry.status === "in_review") totals.inReview += 1;
      if (entry.status === "on_hold") totals.onHold += 1;
      if (entry.status === "rejected") totals.rejected += 1;
    });

    return totals;
  }, [prequalifications, suppliers.length]);

  const resetForm = () => {
    setFormValues({
      supplierId: "",
      status: "not_started",
      riskTier: "medium",
      prequalifiedOn: "",
      expiresOn: "",
      notes: "",
    });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!formValues.supplierId) {
      setFormError(t("suppliersPrequalification.form.validation.supplier"));
      return;
    }

    const supplier = supplierOptions.find(
      (option) => option.id === formValues.supplierId,
    );

    if (!supplier) {
      setFormError(t("suppliersPrequalification.form.validation.supplier"));
      return;
    }

    setPrequalifications((prev) => {
      const existingIndex = prev.findIndex(
        (entry) => entry.supplierId === formValues.supplierId,
      );
      const updatedEntry = {
        supplierId: formValues.supplierId,
        supplierName: supplier.name,
        status: formValues.status,
        riskTier: formValues.riskTier,
        prequalifiedOn: formValues.prequalifiedOn,
        expiresOn: formValues.expiresOn,
        notes: formValues.notes,
      };

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = updatedEntry;
        return next;
      }

      return [...prev, updatedEntry];
    });

    setFormSuccess(
      t("suppliersPrequalification.form.success", { name: supplier.name }),
    );
    resetForm();
  };

  const handleEdit = (entry) => {
    setFormValues({
      supplierId: entry.supplierId,
      status: entry.status,
      riskTier: entry.riskTier,
      prequalifiedOn: entry.prequalifiedOn || "",
      expiresOn: entry.expiresOn || "",
      notes: entry.notes || "",
    });
    setFormError("");
    setFormSuccess("");
  };

  const handleClear = (supplierId) => {
    setPrequalifications((prev) =>
      prev.filter((entry) => entry.supplierId !== supplierId),
    );
    if (formValues.supplierId === supplierId) {
      resetForm();
    }
  };

  const resolveStatusLabel = (status) => {
    const option = STATUS_OPTIONS.find((item) => item.value === status);
    return option ? t(option.labelKey) : t("suppliersPrequalification.status.notStarted");
  };

  const resolveRiskLabel = (riskTier) => {
    const option = RISK_OPTIONS.find((item) => item.value === riskTier);
    return option ? t(option.labelKey) : "-";
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t("suppliersPrequalification.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {t("suppliersPrequalification.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSuppliers}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("suppliersPrequalification.refresh")}
          </button>
        </div>

        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-100">
          {t("suppliersPrequalification.note")}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label={t("suppliersPrequalification.stats.total")} value={statusCounts.total} />
          <StatCard
            label={t("suppliersPrequalification.stats.prequalified")}
            value={statusCounts.prequalified}
          />
          <StatCard
            label={t("suppliersPrequalification.stats.inReview")}
            value={statusCounts.inReview}
          />
          <StatCard
            label={t("suppliersPrequalification.stats.onHold")}
            value={statusCounts.onHold}
          />
          <StatCard
            label={t("suppliersPrequalification.stats.rejected")}
            value={statusCounts.rejected}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("suppliersPrequalification.form.title")}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {t("suppliersPrequalification.form.subtitle")}
                </p>
              </div>

              <form className="space-y-4 px-4 py-4" onSubmit={handleSubmit}>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                    htmlFor="prequal-supplier"
                  >
                    {t("suppliersPrequalification.form.supplier")}
                  </label>
                  <select
                    id="prequal-supplier"
                    name="supplierId"
                    value={formValues.supplierId}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                  >
                    <option value="">{t("suppliersPrequalification.form.selectSupplier")}</option>
                    {supplierOptions.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      htmlFor="prequal-status"
                    >
                      {t("suppliersPrequalification.form.status")}
                    </label>
                    <select
                      id="prequal-status"
                      name="status"
                      value={formValues.status}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      htmlFor="prequal-risk"
                    >
                      {t("suppliersPrequalification.form.risk")}
                    </label>
                    <select
                      id="prequal-risk"
                      name="riskTier"
                      value={formValues.riskTier}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    >
                      {RISK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      htmlFor="prequal-date"
                    >
                      {t("suppliersPrequalification.form.prequalifiedOn")}
                    </label>
                    <input
                      id="prequal-date"
                      name="prequalifiedOn"
                      type="date"
                      value={formValues.prequalifiedOn}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                      htmlFor="prequal-expiry"
                    >
                      {t("suppliersPrequalification.form.expiresOn")}
                    </label>
                    <input
                      id="prequal-expiry"
                      name="expiresOn"
                      type="date"
                      value={formValues.expiresOn}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                    htmlFor="prequal-notes"
                  >
                    {t("suppliersPrequalification.form.notes")}
                  </label>
                  <textarea
                    id="prequal-notes"
                    name="notes"
                    value={formValues.notes}
                    onChange={handleFormChange}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    placeholder={t("suppliersPrequalification.form.notesPlaceholder")}
                  />
                </div>

                {formError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100">
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-100">
                    {formSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  {t("suppliersPrequalification.form.save")}
                </button>
              </form>
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="prequal-search"
              >
                {t("suppliersPrequalification.search.label")}
              </label>
              <input
                id="prequal-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("suppliersPrequalification.search.placeholder")}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {loading ? (
                <div className="p-6 text-center text-gray-600 dark:text-gray-300">
                  {t("suppliersPrequalification.loading")}
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-600 dark:text-red-400">
                  <p className="mb-3 font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={fetchSuppliers}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("suppliersPrequalification.retry")}
                  </button>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-6 text-center text-gray-600 dark:text-gray-300">
                  {t("suppliersPrequalification.empty")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                          {t("suppliersPrequalification.table.supplier")}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                          {t("suppliersPrequalification.table.status")}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                          {t("suppliersPrequalification.table.risk")}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                          {t("suppliersPrequalification.table.prequalifiedOn")}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                          {t("suppliersPrequalification.table.expiresOn")}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                          {t("suppliersPrequalification.table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
                      {filteredSuppliers.map((supplier) => {
                        const entry = prequalificationBySupplier.get(supplier.id);
                        return (
                          <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {supplier.name}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {resolveStatusLabel(entry?.status || "not_started")}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {entry?.riskTier ? resolveRiskLabel(entry.riskTier) : "-"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {entry?.prequalifiedOn || "-"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {entry?.expiresOn || "-"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEdit(
                                      entry || {
                                        supplierId: supplier.id,
                                        supplierName: supplier.name,
                                        status: "not_started",
                                        riskTier: "medium",
                                        prequalifiedOn: "",
                                        expiresOn: "",
                                        notes: "",
                                      },
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                >
                                  <ClipboardList className="h-4 w-4" />
                                  {t("suppliersPrequalification.table.manage")}
                                </button>
                                {entry ? (
                                  <button
                                    type="button"
                                    onClick={() => handleClear(supplier.id)}
                                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-red-700/70 dark:text-red-200 dark:hover:bg-red-900/30"
                                  >
                                    {t("suppliersPrequalification.table.clear")}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
  </div>
);

export default SuppliersPrequalificationPage;