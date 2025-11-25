import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import Navbar from "../components/Navbar";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from "../api/suppliers";
import { useTranslation } from "react-i18next";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const SuppliersPage = () => {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [formValues, setFormValues] = useState({
    name: "",
    contact_email: "",
    contact_phone: "",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await listSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to load suppliers:", err);
      setError(t("suppliersPage.error"));
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const supplierStats = useMemo(() => {
    const total = suppliers.length;
    const withEmail = suppliers.filter((supplier) => supplier?.contact_email).length;
    const withPhone = suppliers.filter((supplier) => supplier?.contact_phone).length;

    return {
      total,
      withEmail,
      withPhone,
      withoutContact: total - Math.max(withEmail, withPhone),
    };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;

    return suppliers.filter((supplier) => {
      const name = supplier?.name?.toLowerCase?.() || "";
      const email = supplier?.contact_email?.toLowerCase?.() || "";
      const phone = supplier?.contact_phone?.toLowerCase?.() || "";

      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term)
      );
    });
  }, [search, suppliers]);

  const resetForm = () => {
    setSelectedSupplierId(null);
    setFormValues({ name: "", contact_email: "", contact_phone: "" });
  };

  const handleEditSelect = (supplier) => {
    setSelectedSupplierId(supplier.id);
    setFormValues({
      name: supplier.name || "",
      contact_email: supplier.contact_email || "",
      contact_phone: supplier.contact_phone || "",
    });
    setFormError("");
    setFormSuccess("");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!formValues.name.trim()) {
      setFormError(t("suppliersPage.form.validation.name"));
      return;
    }

    setSaving(true);

    try {
      if (selectedSupplierId) {
        await updateSupplier(selectedSupplierId, formValues);
        setFormSuccess(t("suppliersPage.form.updated"));
      } else {
        await createSupplier(formValues);
        setFormSuccess(t("suppliersPage.form.created"));
      }

      await fetchSuppliers();
      resetForm();
    } catch (err) {
      console.error("❌ Failed to save supplier:", err);
      setFormError(
        err?.response?.data?.message || t("suppliersPage.form.genericError")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    const confirmation = window.confirm(
      t("suppliersPage.actions.confirmDelete", { name: supplier.name })
    );

    if (!confirmation) return;

    setFormError("");
    setFormSuccess("");
    setSaving(true);

    try {
      await deleteSupplier(supplier.id);
      if (selectedSupplierId === supplier.id) {
        resetForm();
      }
      await fetchSuppliers();
      setFormSuccess(t("suppliersPage.form.deleted", { name: supplier.name }));
    } catch (err) {
      console.error("❌ Failed to delete supplier:", err);
      setFormError(
        err?.response?.data?.message || t("suppliersPage.form.deleteError")
      );
    } finally {
      setSaving(false);
    }
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className="p-6 text-center text-gray-600 dark:text-gray-300">
          {t("suppliersPage.loading")}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 text-center text-red-600 dark:text-red-400">
          <p className="mb-3 font-medium">{error}</p>
          <button
            type="button"
            onClick={fetchSuppliers}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
            {t("suppliersPage.retry")}
          </button>
        </div>
      );
    }

    if (filteredSuppliers.length === 0) {
      return (
        <div className="p-6 text-center text-gray-600 dark:text-gray-300">
          {t("suppliersPage.empty")}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.name")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.email")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.phone")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.createdAt")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
            {filteredSuppliers.map((supplier) => (
              <tr
                key={supplier.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  selectedSupplierId === supplier.id
                    ? "bg-blue-50/60 dark:bg-blue-900/40"
                    : ""
                }`}
              >
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {supplier.name || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {supplier.contact_email || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {supplier.contact_phone || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(supplier.created_at)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSelect(supplier)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      <Pencil className="h-4 w-4" />
                      {t("suppliersPage.actions.manage")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(supplier)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-red-700/70 dark:text-red-200 dark:hover:bg-red-900/30"
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("suppliersPage.actions.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t("suppliersPage.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {t("suppliersPage.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSuppliers}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("suppliersPage.refresh")}
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("suppliersPage.stats.total")}
            value={supplierStats.total}
          />
          <StatCard
            label={t("suppliersPage.stats.withEmail")}
            value={supplierStats.withEmail}
          />
          <StatCard
            label={t("suppliersPage.stats.withPhone")}
            value={supplierStats.withPhone}
          />
          <StatCard
            label={t("suppliersPage.stats.needsContacts")}
            value={Math.max(supplierStats.withoutContact, 0)}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("suppliersPage.form.title")}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {selectedSupplierId
                    ? t("suppliersPage.form.editing")
                    : t("suppliersPage.form.description")}
                </p>
              </div>

              <form className="space-y-4 px-4 py-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-name">
                    {t("suppliersPage.form.name")}
                  </label>
                  <input
                    id="supplier-name"
                    name="name"
                    type="text"
                    value={formValues.name}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    placeholder={t("suppliersPage.form.namePlaceholder")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-email">
                      {t("suppliersPage.form.email")}
                    </label>
                    <input
                      id="supplier-email"
                      name="contact_email"
                      type="email"
                      value={formValues.contact_email}
                      onChange={handleFormChange}
                      placeholder={t("suppliersPage.form.emailPlaceholder")}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-phone">
                      {t("suppliersPage.form.phone")}
                    </label>
                    <input
                      id="supplier-phone"
                      name="contact_phone"
                      type="tel"
                      value={formValues.contact_phone}
                      onChange={handleFormChange}
                      placeholder={t("suppliersPage.form.phonePlaceholder")}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    />
                  </div>
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

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    {selectedSupplierId ? t("suppliersPage.form.update") : t("suppliersPage.form.create")}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                    disabled={saving}
                  >
                    {t("suppliersPage.form.reset")}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-search">
                {t("suppliersPage.search.label")}
              </label>
              <input
                id="supplier-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("suppliersPage.search.placeholder")}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {renderTable()}
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

export default SuppliersPage;