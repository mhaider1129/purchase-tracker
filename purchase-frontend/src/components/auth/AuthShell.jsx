import React from "react";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../LanguageSwitcher";

const AuthShell = ({ children, compact = false }) => {
  const { t } = useTranslation();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.1),_transparent_30%)]"
      />
      <div
        className={`relative mx-auto grid min-h-screen w-full max-w-[1440px] ${compact ? "lg:grid-cols-[1fr_1.05fr]" : "lg:grid-cols-2"}`}
      >
        <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-40 -left-28 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div className="relative flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500 shadow-lg shadow-blue-950/40">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold tracking-wide">
                {t("authShell.brand")}
              </p>
              <p className="text-xs text-slate-400">
                {t("authShell.organization")}
              </p>
            </div>
          </div>

          <div className="relative max-w-xl py-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {t("authShell.badge")}
            </span>
            <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              {t("authShell.headline")}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              {t("authShell.description")}
            </p>
            <ul className="mt-8 grid gap-4 text-sm text-slate-200">
              {["visibility", "approvals", "security"].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2
                    className="h-5 w-5 flex-none text-emerald-400"
                    aria-hidden="true"
                  />
                  {t(`authShell.benefits.${item}`)}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-slate-500">
            {t("login.copyright", { year: new Date().getFullYear() })}
          </p>
        </section>

        <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
          <div className="flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("authShell.brand")}
              </span>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="flex flex-1 items-center justify-center py-8">
            <div className={compact ? "w-full max-w-2xl" : "w-full max-w-md"}>
              {children}
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 lg:hidden">
            {t("login.copyright", { year: new Date().getFullYear() })}
          </p>
        </section>
      </div>
    </main>
  );
};

export default AuthShell;