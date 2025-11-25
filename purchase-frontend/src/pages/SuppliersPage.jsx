import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Navbar from "../components/Navbar";
import { listSuppliers } from "../api/suppliers";
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
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
      </main>
    </div>
  );
};

export default SuppliersPage;