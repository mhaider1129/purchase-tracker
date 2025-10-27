// src/pages/Login.js

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const emailInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setErrorMsg(t('login.emailPasswordRequired'));
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/login', {
        email: trimmedEmail,
        password,
      });

      const token = res.data.token;
      if (!token) throw new Error('No token returned from server');

      localStorage.setItem('token', token);

      const userRes = await api.get('/api/users/me');
      const user = userRes.data;

      if (!user || user.is_active === false) {
        setErrorMsg(t('login.accountInactive'));
        localStorage.removeItem('token');
        return;
      }

      localStorage.setItem('currentUser', JSON.stringify(user));

      // ✅ Redirect all users to the request type selector
      navigate('/');
    } catch (err) {
      console.error('❌ Login failed:', err);
      setErrorMsg(err?.response?.data?.message || t('login.errorCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-100 to-white dark:from-gray-800 dark:to-gray-900 px-4">
        <form
        onSubmit={handleLogin}
        className="bg-white dark:bg-gray-800 p-8 shadow-md rounded w-full max-w-sm border border-gray-200 dark:border-gray-700"
        >
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-700">{t('login.title')}</h2>

        {errorMsg && (
          <div className="mb-4 text-sm text-red-600 bg-red-100 px-3 py-2 rounded border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1 text-gray-700 dark:text-gray-300">{t('login.email')}</label>
          <input
            ref={emailInputRef}
            type="email"
            className="w-full p-2 border border-gray-300 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1 text-gray-700 dark:text-gray-300">{t('login.password')}</label>
          <input
            type="password"
            className="w-full p-2 border border-gray-300 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full text-white py-2 rounded transition duration-200 ${
            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? t('login.loggingIn') : t('login.button')}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
        {t('login.requestAccessPrompt')}{' '}
        <Link to="/request-account" className="text-blue-600 hover:underline dark:text-blue-400">
          {t('login.requestAccessLink')}
        </Link>
      </p>

      <p className="mt-2 text-sm text-gray-500">
        {t('login.copyright', { year: new Date().getFullYear() })}
      </p>
    </div>
  );
};

export default Login;
