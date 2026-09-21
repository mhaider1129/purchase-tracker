import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Store,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { fetchCurrentUser } from "../api/currentUser";
import AuthShell from "../components/auth/AuthShell";
import { useAuth } from "../hooks/useAuth";

const Login = () => {
  const { t } = useTranslation();
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const emailInputRef = useRef(null);
  const navigate = useNavigate();
  const { login: persistToken, logout } = useAuth();

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const trimmedLoginIdentifier = loginIdentifier.trim();

    if (!trimmedLoginIdentifier || !password) {
      setErrorMsg(t("login.emailPasswordRequired"));
      setLoading(false);
      return;
    }

    try {
      const res = await api.post("/auth/login/", {
        login: trimmedLoginIdentifier,
        password,
      });
      const token = res.data.token;
      if (!token) throw new Error("No token returned from server");
      persistToken(token);

      try {
        const userRes = await fetchCurrentUser();
        if (!userRes.data || userRes.data.is_active === false) {
          setErrorMsg(t("login.accountInactive"));
          logout();
          return;
        }
      } catch (profileError) {
        console.error("Failed to load user profile:", profileError);
        setErrorMsg(t("login.errorCredentials"));
        logout();
        return;
      }
      navigate("/");
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMsg(
        error?.response?.data?.message || t("login.errorCredentials"),
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white py-3 pe-4 ps-11 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <AuthShell>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          {t("login.welcome")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {t("login.title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {t("login.subtitle")}
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            {t("login.loginIdentifier")}
          </label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="login-email"
              ref={emailInputRef}
              type="text"
              autoComplete="username"
              className={inputClass}
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              placeholder={t("login.identifierPlaceholder")}
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            {t("login.password")}
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={`${inputClass} pe-12`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("login.passwordPlaceholder")}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute end-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800"
              aria-label={
                showPassword
                  ? t("login.hideCharacters")
                  : t("login.showCharacters")
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("login.loggingIn") : t("login.button")}{" "}
          {!loading && (
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>
      </form>

      <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span>{t("login.otherAccess")}</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <Link
        to="/rfx-portal"
        className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700"
      >
        <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Store className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white">
            {t("login.supplierPortalTitle")}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {t("login.supplierPortalDescription")}
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 flex-none text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600 rtl:rotate-180 rtl:group-hover:-translate-x-1"
          aria-hidden="true"
        />
        <span className="sr-only">{t("login.supplierPortalCta")}</span>
      </Link>

      <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("login.requestAccessPrompt")}{" "}
        <Link
          to="/request-account"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
        >
          {t("login.requestAccessLink")}
        </Link>
      </p>
    </AuthShell>
  );
};

export default Login;