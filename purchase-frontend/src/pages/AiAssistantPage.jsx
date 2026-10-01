import React, { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, Sparkles } from "lucide-react";
import aiService from "../api/aiService";
import AiConversation from "../components/ai/AiConversation";

const starterPrompts = [
  "What needs my attention?",
  "Show delayed procurement cases",
  "Summarize Supply Chain performance",
  "Show procurement cases older than 30 days",
  "Show my current workload",
];

const statusConfig = {
  checking: {
    label: "Checking AI",
    dot: "bg-amber-500",
    style:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
  },
  available: {
    label: "AI Available",
    dot: "bg-emerald-500",
    style:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  },
  unavailable: {
    label: "AI Unavailable",
    dot: "bg-rose-500",
    style:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100",
  },
};

const unavailableMessage = (details) => {
  switch (details?.reason) {
    case "AI_MODEL_TOOLS_UNSUPPORTED":
      return `The configured model${details.model ? ` (${details.model})` : ""} does not support the tools required by this assistant.`;
    case "AI_PROVIDER_CONFIGURATION_ERROR":
      return "The AI provider configuration is invalid. Ask an administrator to verify the backend AI settings.";
    case "AI_PROVIDER_TIMEOUT":
      return "The configured AI service timed out. Retry the connection or ask an administrator to check the service.";
    case "AI_SERVICE_UNAVAILABLE":
      return "The configured AI service could not be reached. Ask an administrator to verify that it is running and reachable from the backend.";
    default:
      return "The configured AI service could not be reached.";
  }
};

const AiAssistantPage = () => {
  const [health, setHealth] = useState("checking");
  const [healthDetails, setHealthDetails] = useState(null);
  const checkHealth = useCallback(() => {
    setHealth("checking");
    setHealthDetails(null);
    return aiService
      .health()
      .then((response) => {
        setHealthDetails(response.data || null);
        setHealth(
          String(response.data?.status).toLowerCase() === "available"
            ? "available"
            : "unavailable",
        );
      })
      .catch((error) => {
        setHealthDetails(error.response?.data || null);
        setHealth("unavailable");
      });
  }, []);

  useEffect(() => {
    let active = true;
    const updateHealth = () => {
      setHealth("checking");
      return aiService
        .health()
        .then((response) => {
          if (active) {
            setHealthDetails(response.data || null);
            setHealth(
              String(response.data?.status).toLowerCase() === "available"
                ? "available"
                : "unavailable",
            );
          }
        })
        .catch((error) => {
          if (active) {
            setHealthDetails(error.response?.data || null);
            setHealth("unavailable");
          }
        });
    };
    updateHealth();
    return () => {
      active = false;
    };
  }, []);
  const status = statusConfig[health];

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-100 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-slate-900 dark:text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
                <Sparkles size={21} />
              </span>{" "}
              AI Assistant
            </h1>
            <p className="mt-1 pl-0 text-sm text-slate-500 dark:text-slate-400 sm:pl-[3.25rem]">
              Supply Chain Intelligence
            </p>
          </div>
          <div
            role="status"
            aria-label={`AI status: ${status.label}`}
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold ${status.style}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${status.dot} ${health === "checking" ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            {status.label}
          </div>
        </header>
        {health === "unavailable" && (
          <div
            role="alert"
            className="mx-5 mt-5 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200 sm:mx-7 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 shrink-0" size={18} />
              <span>
                <strong>AI Intelligence is currently unavailable.</strong>{" "}
                {unavailableMessage(healthDetails)} Normal procurement functions
                are unaffected.
              </span>
            </div>
            <button
              type="button"
              onClick={checkHealth}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900"
            >
              <RefreshCw size={15} /> Retry connection
            </button>
          </div>
        )}
        <AiConversation
          starterPrompts={starterPrompts}
          disabled={health !== "available"}
        />
      </div>
    </div>
  );
};

export default AiAssistantPage;