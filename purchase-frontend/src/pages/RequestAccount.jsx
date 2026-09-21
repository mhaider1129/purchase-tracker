import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import AuthShell from "../components/auth/AuthShell";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  institute_id: "",
  department_id: "",
  section_id: "",
  employee_id: "",
  phone_number: "",
};

const RequestAccount = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [institutes, setInstitutes] = useState([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchInstitutes = async () => {
      setLoadingInstitutes(true);
      try {
        const res = await api.get("/auth/register-request/institutes");
        const data = res.data?.institutes || [];
        setInstitutes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load institutes", error);
        setMessage({
          type: "error",
          text: t("requestAccount.loadInstitutesError"),
        });
      } finally {
        setLoadingInstitutes(false);
      }
    };

    fetchInstitutes();
  }, [t]);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!form.institute_id) {
        setDepartments([]);
        return;
      }

      setLoadingDepartments(true);
      try {
        const res = await api.get("/auth/register-request/departments", {
          params: { institute_id: form.institute_id },
        });
        const data = res.data?.departments || [];
        setDepartments(
          Array.isArray(data)
            ? data.map((dep) => ({
                ...dep,
                sections: Array.isArray(dep.sections) ? dep.sections : [],
              }))
            : [],
        );
      } catch (error) {
        console.error("Failed to load departments", error);
        setMessage({
          type: "error",
          text: t("requestAccount.loadDepartmentsError"),
        });
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, [form.institute_id, t]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInstituteChange = (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      institute_id: value,
      department_id: "",
      section_id: "",
    }));
    setDepartments([]);
  };

  const handleDepartmentChange = (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, department_id: value, section_id: "" }));
  };

  const resetForm = () => {
    setForm(defaultForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setMessage({ type: "error", text: t("requestAccount.requiredFields") });
      return;
    }

    if (!form.employee_id.trim()) {
      setMessage({
        type: "error",
        text: t("requestAccount.employeeIdRequired"),
      });
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage({ type: "error", text: t("requestAccount.passwordMismatch") });
      return;
    }

    if (!form.institute_id) {
      setMessage({
        type: "error",
        text: t("requestAccount.instituteRequired"),
      });
      return;
    }

    const departmentId = parseInt(form.department_id, 10);
    if (Number.isNaN(departmentId)) {
      setMessage({
        type: "error",
        text: t("requestAccount.departmentRequired"),
      });
      return;
    }

    const sectionId = form.section_id ? parseInt(form.section_id, 10) : null;
    if (form.section_id && Number.isNaN(sectionId)) {
      setMessage({ type: "error", text: t("requestAccount.sectionInvalid") });
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/auth/register-request", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        department_id: departmentId,
        section_id: sectionId,
        employee_id: form.employee_id.trim(),
        phone_number: form.phone_number.trim(),
      });

      setMessage({ type: "success", text: t("requestAccount.successMessage") });
      resetForm();
    } catch (error) {
      console.error("Account request failed", error);
      const fallbackMessage = t("requestAccount.failureMessage");
      const errorText =
        error.response?.data?.message ||
        error.response?.data?.error ||
        fallbackMessage;
      setMessage({ type: "error", text: errorText });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDepartment = departments.find(
    (dep) => String(dep.id) === String(form.department_id),
  );

  return (
    <AuthShell compact>
      <div className="mb-7">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />{" "}
          {t("requestAccount.loginLink")}
        </Link>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          {t("requestAccount.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {t("requestAccount.title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {t("requestAccount.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            className={`rounded-xl border p-3 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950">
            <UserRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {t("requestAccount.personalDetails")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("requestAccount.personalDetailsHint")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="request-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              {t("requestAccount.name")}
            </label>
            <input
              id="request-name"
              type="text"
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {t("requestAccount.email")}
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {t("requestAccount.employeeId")}
            </label>
            <input
              type="text"
              name="employee_id"
              value={form.employee_id}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>

          <div>
            <label
              htmlFor="request-phone"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              {t("requestAccount.phoneNumber")}
            </label>
            <input
              id="request-phone"
              type="tel"
              name="phone_number"
              autoComplete="tel"
              value={form.phone_number}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="request-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              {t("requestAccount.password")}
            </label>
            <input
              id="request-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>
          <div>
            <label
              htmlFor="request-confirm-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              {t("requestAccount.confirmPassword")}
            </label>
            <input
              id="request-confirm-password"
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          className="-mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}{" "}
          {showPassword ? t("login.hidePassword") : t("login.showPassword")}
        </button>

        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 pt-2 dark:border-slate-800">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {t("requestAccount.organizationDetails")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("requestAccount.organizationDetailsHint")}
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="request-institute"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            {t("requestAccount.institute")}
          </label>
          <select
            id="request-institute"
            name="institute_id"
            value={form.institute_id}
            onChange={handleInstituteChange}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            required
          >
            <option value="">
              {loadingInstitutes
                ? t("requestAccount.loadingInstitutes")
                : t("requestAccount.selectInstitute")}
            </option>
            {institutes.map((institute) => (
              <option key={institute.id} value={institute.id}>
                {institute.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {t("requestAccount.department")}
          </label>
          <select
            name="department_id"
            value={form.department_id}
            onChange={handleDepartmentChange}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            disabled={!form.institute_id || loadingDepartments}
            required
          >
            <option value="">
              {!form.institute_id
                ? t("requestAccount.selectInstituteFirst")
                : loadingDepartments
                  ? t("requestAccount.loading")
                  : t("requestAccount.selectDepartment")}
            </option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>

        {selectedDepartment && selectedDepartment.sections?.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {t("requestAccount.section")}
            </label>
            <select
              name="section_id"
              value={form.section_id}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            >
              <option value="">
                {t("requestAccount.selectSectionOptional")}
              </option>
              {selectedDepartment.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-lg transition ${
            submitting
              ? "bg-slate-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
          }`}
        >
          {submitting
            ? t("requestAccount.submitting")
            : t("requestAccount.submitButton")}{" "}
          {!submitting && <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
        </button>

        <p className="text-sm text-center text-gray-500 dark:text-gray-300">
          {t("requestAccount.reviewNote")}
        </p>
      </form>
    </AuthShell>
  );
};

export default RequestAccount;