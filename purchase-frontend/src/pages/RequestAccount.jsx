import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

const defaultForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  institute_id: '',
  department_id: '',
  section_id: '',
  employee_id: '',
};

const RequestAccount = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [institutes, setInstitutes] = useState([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchInstitutes = async () => {
      setLoadingInstitutes(true);
      try {
        const res = await api.get('/auth/register-request/institutes');
        const data = res.data?.institutes || [];
        setInstitutes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load institutes', error);
        setMessage({ type: 'error', text: t('requestAccount.loadInstitutesError') });
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
        const res = await api.get('/auth/register-request/departments', {
          params: { institute_id: form.institute_id },
        });
        const data = res.data?.departments || [];
        setDepartments(
          Array.isArray(data)
            ? data.map((dep) => ({
                ...dep,
                sections: Array.isArray(dep.sections) ? dep.sections : [],
              }))
            : []
        );
      } catch (error) {
        console.error('Failed to load departments', error);
        setMessage({ type: 'error', text: t('requestAccount.loadDepartmentsError') });
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
      department_id: '',
      section_id: '',
    }));
    setDepartments([]);
  };

  const handleDepartmentChange = (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, department_id: value, section_id: '' }));
  };

  const resetForm = () => {
    setForm(defaultForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setMessage({ type: 'error', text: t('requestAccount.requiredFields') });
      return;
    }

    if (!form.employee_id.trim()) {
      setMessage({ type: 'error', text: t('requestAccount.employeeIdRequired') });
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: t('requestAccount.passwordMismatch') });
      return;
    }

    if (!form.institute_id) {
      setMessage({ type: 'error', text: t('requestAccount.instituteRequired') });
      return;
    }

    const departmentId = parseInt(form.department_id, 10);
    if (Number.isNaN(departmentId)) {
      setMessage({ type: 'error', text: t('requestAccount.departmentRequired') });
      return;
    }

    const sectionId = form.section_id ? parseInt(form.section_id, 10) : null;
    if (form.section_id && Number.isNaN(sectionId)) {
      setMessage({ type: 'error', text: t('requestAccount.sectionInvalid') });
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/auth/register-request', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        department_id: departmentId,
        section_id: sectionId,
        employee_id: form.employee_id.trim(),
      });

      setMessage({ type: 'success', text: t('requestAccount.successMessage') });
      resetForm();
    } catch (error) {
      console.error('Account request failed', error);
      const fallbackMessage = t('requestAccount.failureMessage');
      const errorText =
        error.response?.data?.message ||
        error.response?.data?.error ||
        fallbackMessage;
      setMessage({ type: 'error', text: errorText });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDepartment = departments.find(
    (dep) => String(dep.id) === String(form.department_id)
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center text-blue-700 dark:text-blue-300">
          {t('requestAccount.title')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
          {t('requestAccount.subtitle')}
        </p>

        {message && (
          <div
            className={`p-3 rounded text-sm ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {t('requestAccount.name')}
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {t('requestAccount.email')}
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
            {t('requestAccount.employeeId')}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {t('requestAccount.password')}
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {t('requestAccount.confirmPassword')}
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {t('requestAccount.institute')}
          </label>
          <select
            name="institute_id"
            value={form.institute_id}
            onChange={handleInstituteChange}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            required
          >
            <option value="">
              {loadingInstitutes ? t('requestAccount.loadingInstitutes') : t('requestAccount.selectInstitute')}
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
            {t('requestAccount.department')}
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
                ? t('requestAccount.selectInstituteFirst')
                : loadingDepartments
                  ? t('requestAccount.loading')
                  : t('requestAccount.selectDepartment')}
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
              {t('requestAccount.section')}
            </label>
            <select
              name="section_id"
              value={form.section_id}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200 dark:bg-gray-900"
            >
              <option value="">{t('requestAccount.selectSectionOptional')}</option>
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
          className={`w-full py-2 rounded text-white transition duration-200 ${
            submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {submitting ? t('requestAccount.submitting') : t('requestAccount.submitButton')}
        </button>

        <p className="text-sm text-center text-gray-500 dark:text-gray-300">
          {t('requestAccount.backToLogin')}{' '}
          <Link to="/login" className="text-blue-600 hover:underline dark:text-blue-400">
            {t('requestAccount.loginLink')}
          </Link>
        </p>
      </form>
    </div>
  );
};

export default RequestAccount;