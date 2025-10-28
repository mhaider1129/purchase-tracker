// src/pages/ChangePassword.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changePassword } from '../api/auth';

const ChangePassword = () => {
  const { t } = useTranslation();
  const [formValues, setFormValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState({ type: null, message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: null, message: '' });

    const trimmedCurrent = formValues.currentPassword.trim();
    const trimmedNew = formValues.newPassword.trim();
    const trimmedConfirm = formValues.confirmPassword.trim();

    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      setStatus({ type: 'error', message: t('changePassword.validation.required') });
      return;
    }

    if (trimmedNew.length < 8) {
      setStatus({ type: 'error', message: t('changePassword.validation.length') });
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setStatus({ type: 'error', message: t('changePassword.validation.match') });
      return;
    }

    setSubmitting(true);

    try {
      const response = await changePassword({
        currentPassword: trimmedCurrent,
        newPassword: trimmedNew,
      });

      setStatus({ type: 'success', message: response?.message || t('changePassword.success') });
      setFormValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const message = error?.response?.data?.message ?? t('changePassword.error');
      setStatus({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="mb-6 space-y-3">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded dark:text-blue-400 dark:hover:text-blue-300 dark:focus:ring-offset-gray-800"
          >
            {t('changePassword.backToHome')}
          </Link>

          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('changePassword.title')}
          </h1>
        </div>

        {status.type && (
          <div
            role="alert"
            className={`mb-4 rounded border px-3 py-2 text-sm ${
              status.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200'
            }`}
          >
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="currentPassword">
              {t('changePassword.currentPassword')}
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={formValues.currentPassword}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="newPassword">
              {t('changePassword.newPassword')}
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={formValues.newPassword}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="confirmPassword">
              {t('changePassword.confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formValues.confirmPassword}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              required
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('changePassword.requirements')}
          </p>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
              submitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-blue-700'
            }`}
          >
            {submitting ? t('changePassword.saving') : t('changePassword.save')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;