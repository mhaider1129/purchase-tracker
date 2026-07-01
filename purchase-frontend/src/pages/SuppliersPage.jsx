import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  LayoutDashboard,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  createSupplier,
  createSupplierContact,
  deleteSupplier,
  deleteSupplierContact,
  listSupplierContacts,
  listSuppliers,
  updateSupplier,
  updateSupplierContact,
} from "../api/suppliers";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import AmountInput from "../components/ui/AmountInput";

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
    supplier_type: "",
    tax_number: "",
    bank_info: "",
    currency: "",
    payment_terms: "",
    lead_time_days: "",
    credit_limit: "",
    status: "",
    country: "",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactFormValues, setContactFormValues] = useState({
    name: "",
    phone_number: "",
    email: "",
    position: "",
    responsibility: "",
    notes: "",
    is_primary: false,
  });

  const supplierModules = useMemo(
    () => [
      {
        key: "master",
        label: t("suppliersPage.modules.master.title"),
        description: t("suppliersPage.modules.master.description"),
        to: "/suppliers",
        icon: UsersRound,
        current: true,
      },
      {
        key: "srm",
        label: t("suppliersPage.modules.srm.title"),
        description: t("suppliersPage.modules.srm.description"),
        to: "/supplier-srm",
        icon: ShieldCheck,
      },
      {
        key: "evaluations",
        label: t("suppliersPage.modules.evaluations.title"),
        description: t("suppliersPage.modules.evaluations.description"),
        to: "/supplier-evaluations",
        icon: ClipboardCheck,
      },
      {
        key: "dashboard",
        label: t("suppliersPage.modules.dashboard.title"),
        description: t("suppliersPage.modules.dashboard.description"),
        to: "/supplier-dashboard",
        icon: LayoutDashboard,
      },
      {
        key: "prequalification",
        label: t("suppliersPage.modules.prequalification.title"),
        description: t("suppliersPage.modules.prequalification.description"),
        to: "/supplier-prequalification",
        icon: UsersRound,
      },
    ],
    [t],
  );

  const supplierLifecycle = useMemo(
    () => [
      {
        key: "registration",
        title: t("suppliersPage.lifecycle.steps.registration.title"),
        points: t("suppliersPage.lifecycle.steps.registration.points", {
          returnObjects: true,
        }),
      },
      {
        key: "documents",
        title: t("suppliersPage.lifecycle.steps.documents.title"),
        points: t("suppliersPage.lifecycle.steps.documents.points", {
          returnObjects: true,
        }),
      },
      {
        key: "profile",
        title: t("suppliersPage.lifecycle.steps.profile.title"),
        points: t("suppliersPage.lifecycle.steps.profile.points", {
          returnObjects: true,
        }),
      },
      {
        key: "compliance",
        title: t("suppliersPage.lifecycle.steps.compliance.title"),
        points: t("suppliersPage.lifecycle.steps.compliance.points", {
          returnObjects: true,
        }),
      },
      {
        key: "classification",
        title: t("suppliersPage.lifecycle.steps.classification.title"),
        points: t("suppliersPage.lifecycle.steps.classification.points", {
          returnObjects: true,
        }),
      },
      {
        key: "activation",
        title: t("suppliersPage.lifecycle.steps.activation.title"),
        points: t("suppliersPage.lifecycle.steps.activation.points", {
          returnObjects: true,
        }),
      },
    ],
    [t],
  );

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
      const supplierType = supplier?.supplier_type?.toLowerCase?.() || "";
      const country = supplier?.country?.toLowerCase?.() || "";

      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        supplierType.includes(term) ||
        country.includes(term)
      );
    });
  }, [search, suppliers]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) || null,
    [selectedSupplierId, suppliers],
  );

  const resetContactForm = () => {
    setSelectedContactId(null);
    setContactFormValues({
      name: "",
      phone_number: "",
      email: "",
      position: "",
      responsibility: "",
      notes: "",
      is_primary: false,
    });
  };

  const fetchSupplierContacts = useCallback(async (supplierId) => {
    if (!supplierId) {
      setContacts([]);
      return;
    }

    setContactsLoading(true);
    setContactError("");
    try {
      const data = await listSupplierContacts(supplierId);
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to load supplier contacts:", err);
      setContactError(t("suppliersPage.contacts.loadError"));
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSupplierContacts(selectedSupplierId);
  }, [fetchSupplierContacts, selectedSupplierId]);

  const handleContactFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setContactFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleContactEditSelect = (contact) => {
    setSelectedContactId(contact.id);
    setContactFormValues({
      name: contact.name || "",
      phone_number: contact.phone_number || "",
      email: contact.email || "",
      position: contact.position || "",
      responsibility: contact.responsibility || "",
      notes: contact.notes || "",
      is_primary: Boolean(contact.is_primary),
    });
    setContactError("");
    setContactSuccess("");
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSupplierId) return;
    setContactError("");
    setContactSuccess("");

    if (!contactFormValues.name.trim()) {
      setContactError(t("suppliersPage.contacts.validation.name"));
      return;
    }

    setSaving(true);
    try {
      if (selectedContactId) {
        await updateSupplierContact(selectedSupplierId, selectedContactId, contactFormValues);
        setContactSuccess(t("suppliersPage.contacts.updated"));
      } else {
        await createSupplierContact(selectedSupplierId, contactFormValues);
        setContactSuccess(t("suppliersPage.contacts.created"));
      }
      await fetchSupplierContacts(selectedSupplierId);
      resetContactForm();
    } catch (err) {
      console.error("❌ Failed to save supplier contact:", err);
      setContactError(err?.response?.data?.message || t("suppliersPage.contacts.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const handleContactDelete = async (contact) => {
    if (!selectedSupplierId) return;
    const confirmation = window.confirm(t("suppliersPage.contacts.confirmDelete", { name: contact.name }));
    if (!confirmation) return;

    setSaving(true);
    setContactError("");
    setContactSuccess("");
    try {
      await deleteSupplierContact(selectedSupplierId, contact.id);
      await fetchSupplierContacts(selectedSupplierId);
      if (selectedContactId === contact.id) resetContactForm();
      setContactSuccess(t("suppliersPage.contacts.deleted", { name: contact.name }));
    } catch (err) {
      console.error("❌ Failed to delete supplier contact:", err);
      setContactError(err?.response?.data?.message || t("suppliersPage.contacts.deleteError"));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedSupplierId(null);
    setContacts([]);
    resetContactForm();
    setContactError("");
    setContactSuccess("");
    setFormValues({
      name: "",
      contact_email: "",
      contact_phone: "",
      supplier_type: "",
      tax_number: "",
      bank_info: "",
      currency: "",
      payment_terms: "",
      lead_time_days: "",
      credit_limit: "",
      status: "",
      country: "",
    });
  };

  const handleEditSelect = (supplier) => {
    setSelectedSupplierId(supplier.id);
    setFormValues({
      name: supplier.name || "",
      contact_email: supplier.contact_email || "",
      contact_phone: supplier.contact_phone || "",
      supplier_type: supplier.supplier_type || "",
      tax_number: supplier.tax_number || "",
      bank_info: supplier.bank_info ? JSON.stringify(supplier.bank_info) : "",
      currency: supplier.currency || "",
      payment_terms: supplier.payment_terms || "",
      lead_time_days: supplier.lead_time_days ?? "",
      credit_limit: supplier.credit_limit ?? "",
      status: supplier.status || "",
      country: supplier.country || "",
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
        const payload = {
          ...formValues,
          bank_info: formValues.bank_info ? JSON.parse(formValues.bank_info) : null,
        };
        await updateSupplier(selectedSupplierId, payload);
        setFormSuccess(t("suppliersPage.form.updated"));
      } else {
        const payload = {
          ...formValues,
          bank_info: formValues.bank_info ? JSON.parse(formValues.bank_info) : null,
        };
        await createSupplier(payload);
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
                {t("suppliersPage.table.type")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.status")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">
                {t("suppliersPage.table.country")}
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
                  {supplier.supplier_type || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {supplier.status || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {supplier.country || "-"}
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

        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("suppliersPage.modules.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {t("suppliersPage.modules.subtitle")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {supplierModules.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.key}
                  className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-semibold uppercase tracking-wide">
                        {module.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {module.description}
                    </p>
                  </div>
                  <div className="mt-4">
                    {module.current ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {t("suppliersPage.modules.current")}
                      </span>
                    ) : (
                      <Link
                        to={module.to}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-blue-900/30"
                      >
                        {t("suppliersPage.modules.view")}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-blue-100 bg-blue-50/60 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("suppliersPage.lifecycle.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {t("suppliersPage.lifecycle.subtitle")}
            </p>
          </div>

          <div className="mb-4 rounded-md border border-blue-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-blue-900/80 dark:bg-gray-900 dark:text-gray-200">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {t("suppliersPage.lifecycle.mainPurposeTitle")}
            </p>
            <p className="mt-1">{t("suppliersPage.lifecycle.mainPurpose")}</p>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("suppliersPage.lifecycle.permissionsTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {t("suppliersPage.lifecycle.permissions", { returnObjects: true }).map((permission) => (
                <span
                  key={permission}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-900/70 dark:bg-blue-900/20 dark:text-blue-200"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {supplierLifecycle.map((step) => (
              <article
                key={step.key}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {step.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/80 dark:bg-emerald-900/20">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {t("suppliersPage.lifecycle.completionPointTitle")}
              </p>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                {t("suppliersPage.lifecycle.completionPoint")}
              </p>
            </div>

            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("suppliersPage.lifecycle.linksTitle")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                {t("suppliersPage.lifecycle.links", { returnObjects: true }).map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-gray-300 px-3 py-1 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

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
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField t={t} id="supplier-type" name="supplier_type" value={formValues.supplier_type} onChange={handleFormChange} labelKey="suppliersPage.form.supplierType" />
                  <InputField t={t} id="supplier-tax-number" name="tax_number" value={formValues.tax_number} onChange={handleFormChange} labelKey="suppliersPage.form.taxNumber" />
                  <InputField t={t} id="supplier-currency" name="currency" value={formValues.currency} onChange={handleFormChange} labelKey="suppliersPage.form.currency" />
                  <InputField t={t} id="supplier-payment-terms" name="payment_terms" value={formValues.payment_terms} onChange={handleFormChange} labelKey="suppliersPage.form.paymentTerms" />
                  <InputField t={t} id="supplier-lead-time-days" name="lead_time_days" value={formValues.lead_time_days} onChange={handleFormChange} labelKey="suppliersPage.form.leadTimeDays" type="number" min="0" />
                  <InputField t={t} id="supplier-credit-limit" name="credit_limit" value={formValues.credit_limit} onChange={handleFormChange} labelKey="suppliersPage.form.creditLimit" amount min="0" step="0.01" />
                  <InputField t={t} id="supplier-status" name="status" value={formValues.status} onChange={handleFormChange} labelKey="suppliersPage.form.status" />
                  <InputField t={t} id="supplier-country" name="country" value={formValues.country} onChange={handleFormChange} labelKey="suppliersPage.form.country" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-bank-info">
                    {t("suppliersPage.form.bankInfo")}
                  </label>
                  <textarea id="supplier-bank-info" name="bank_info" value={formValues.bank_info} onChange={handleFormChange} rows={3} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950" />
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

          <section className="lg:col-span-3">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("suppliersPage.contacts.title")}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {selectedSupplier ? t("suppliersPage.contacts.selected", { name: selectedSupplier.name }) : t("suppliersPage.contacts.selectSupplier")}
                </p>
              </div>
              {selectedSupplier ? (
                <div className="grid gap-6 p-4 lg:grid-cols-3">
                  <form className="space-y-4" onSubmit={handleContactSubmit}>
                    <InputField t={t} id="supplier-contact-name" name="name" value={contactFormValues.name} onChange={handleContactFormChange} labelKey="suppliersPage.contacts.name" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      <InputField t={t} id="supplier-contact-phone" name="phone_number" value={contactFormValues.phone_number} onChange={handleContactFormChange} labelKey="suppliersPage.contacts.phone" type="tel" />
                      <InputField t={t} id="supplier-contact-email" name="email" value={contactFormValues.email} onChange={handleContactFormChange} labelKey="suppliersPage.contacts.email" type="email" />
                      <InputField t={t} id="supplier-contact-position" name="position" value={contactFormValues.position} onChange={handleContactFormChange} labelKey="suppliersPage.contacts.position" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-contact-responsibility">{t("suppliersPage.contacts.responsibility")}</label>
                      <textarea id="supplier-contact-responsibility" name="responsibility" value={contactFormValues.responsibility} onChange={handleContactFormChange} rows={2} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="supplier-contact-notes">{t("suppliersPage.contacts.notes")}</label>
                      <textarea id="supplier-contact-notes" name="notes" value={contactFormValues.notes} onChange={handleContactFormChange} rows={2} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950" />
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      <input type="checkbox" name="is_primary" checked={contactFormValues.is_primary} onChange={handleContactFormChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      {t("suppliersPage.contacts.primary")}
                    </label>
                    {contactError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100">{contactError}</div>}
                    {contactSuccess && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-100">{contactSuccess}</div>}
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">{selectedContactId ? t("suppliersPage.contacts.update") : t("suppliersPage.contacts.create")}</button>
                      <button type="button" onClick={resetContactForm} disabled={saving} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800">{t("suppliersPage.contacts.reset")}</button>
                    </div>
                  </form>
                  <div className="lg:col-span-2">
                    {contactsLoading ? (
                      <div className="p-6 text-center text-gray-600 dark:text-gray-300">{t("suppliersPage.contacts.loading")}</div>
                    ) : contacts.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">{t("suppliersPage.contacts.empty")}</div>
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800"><tr>{["name","phone","email","position","responsibility","actions"].map((key) => <th key={key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-200">{t(`suppliersPage.contacts.table.${key}`)}</th>)}</tr></thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {contacts.map((contact) => (
                              <tr key={contact.id} className={selectedContactId === contact.id ? "bg-blue-50/60 dark:bg-blue-900/40" : ""}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{contact.name}{contact.is_primary ? <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">{t("suppliersPage.contacts.primaryBadge")}</span> : null}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{contact.phone_number || "-"}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{contact.email || "-"}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{contact.position || "-"}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{contact.responsibility || "-"}</td>
                                <td className="px-4 py-3 text-sm"><div className="flex gap-2"><button type="button" onClick={() => handleContactEditSelect(contact)} className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800">{t("suppliersPage.actions.manage")}</button><button type="button" onClick={() => handleContactDelete(contact)} disabled={saving} className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-700/70 dark:text-red-200 dark:hover:bg-red-900/30">{t("suppliersPage.actions.delete")}</button></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">{t("suppliersPage.contacts.noSupplier")}</div>
              )}
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

const InputField = ({ t, id, name, value, onChange, labelKey, type = "text", amount = false, ...props }) => {
  const Field = amount ? AmountInput : "input";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={id}>
        {t(labelKey)}
      </label>
      <Field
        id={id}
        name={name}
        type={amount ? undefined : type}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
        {...props}
      />
    </div>
  );
};

export default SuppliersPage;