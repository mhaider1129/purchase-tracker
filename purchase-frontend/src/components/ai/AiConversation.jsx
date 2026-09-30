import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bot, Database, Send, Sparkles } from "lucide-react";
import aiService, {
  AI_MESSAGE_MAX_LENGTH,
  getAiErrorMessage,
} from "../../api/aiService";
import {
  coverageEntries,
  getSourceRoute,
  getToolLabel,
} from "../../utils/aiPresentation";

const coverageStyle = {
  FULL: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  PARTIAL:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
  MISSING: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  UNAVAILABLE:
    "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  LEGACY_INCOMPLETE:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
};

const ResponseDetails = ({ response }) => {
  const coverage = coverageEntries(response.coverage);
  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      {response.sources.length > 0 && (
        <section aria-label="Evidence">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <Database size={14} /> Evidence
          </h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {response.sources.map((source, index) => {
              const route = getSourceRoute(source);
              const content = (
                <span className="font-semibold">{source.label}</span>
              );
              return (
                <li
                  key={`${source.type}-${source.id}-${index}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {route ? (
                    <Link
                      className="text-blue-700 hover:underline dark:text-blue-300"
                      to={route}
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {coverage.length > 0 && (
        <section
          aria-label="Evidence coverage"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Evidence coverage:
          </span>
          {coverage.map(({ label, status }) => (
            <span
              key={label}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${coverageStyle[status] || coverageStyle.UNAVAILABLE}`}
            >
              <span className="capitalize">{label}</span>: {status}
            </span>
          ))}
        </section>
      )}
      {response.warnings.length > 0 && (
        <section
          aria-label="Warnings"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <h4 className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle size={16} /> Warnings
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {response.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      {response.toolsUsed.length > 0 && (
        <details className="text-sm text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer font-semibold">
            Analysis sources
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {response.toolsUsed.map((tool, index) => (
              <span
                key={`${tool}-${index}`}
                className="rounded-full bg-slate-200 px-2.5 py-1 text-xs dark:bg-slate-700"
              >
                {getToolLabel(tool)}
              </span>
            ))}
          </div>
        </details>
      )}
      {response.suggestedActions.length > 0 && (
        <section aria-label="Suggested actions">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Recommended next steps
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {response.suggestedActions.map((action, index) => (
              <li key={index}>{action.label}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const AiConversation = ({
  context,
  starterPrompts,
  compact = false,
  disabled = false,
}) => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, sending]);

  const send = async (candidate = draft) => {
    const text = candidate.trim();
    if (!text || sending || disabled || text.length > AI_MESSAGE_MAX_LENGTH)
      return;
    setMessages((current) => [...current, { role: "user", text }]);
    setDraft("");
    setError("");
    setSending(true);
    try {
      const response = await aiService.chat({
        message: text,
        conversationId,
        context,
      });
      setConversationId(response.conversationId);
      setMessages((current) => [...current, { role: "assistant", response }]);
    } catch (requestError) {
      setError(getAiErrorMessage(requestError));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setMessages([]);
    setConversationId(null);
    setDraft("");
    setError("");
    inputRef.current?.focus();
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${compact ? "h-full" : ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          AI analysis is read-only and based on available system records.
        </p>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          New Conversation
        </button>
      </div>
      <div
        className={`flex-1 overflow-y-auto p-4 sm:p-6 ${compact ? "min-h-0" : "min-h-[24rem]"}`}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="mx-auto max-w-3xl py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
              <Sparkles aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              Start an intelligence analysis
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose a supported question or enter your own.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  disabled={disabled}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div
                  key={index}
                  className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-700 px-4 py-3 text-sm whitespace-pre-wrap text-white"
                >
                  <span className="sr-only">You said: </span>
                  {message.text}
                </div>
              ) : (
                <article
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Bot size={17} /> AI analysis
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {message.response.message}
                  </p>
                  <ResponseDetails response={message.response} />
                </article>
              ),
            )}
          </div>
        )}
        {sending && (
          <div
            role="status"
            className="mx-auto mt-5 flex max-w-3xl items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
          >
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
              aria-hidden="true"
            />
            Analyzing procurement data...
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mx-auto mt-5 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <label
            className="sr-only"
            htmlFor={`ai-message-${compact ? "panel" : "page"}`}
          >
            Ask AI Intelligence
          </label>
          <textarea
            ref={inputRef}
            id={`ai-message-${compact ? "panel" : "page"}`}
            value={draft}
            maxLength={AI_MESSAGE_MAX_LENGTH}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={compact ? 2 : 3}
            placeholder={
              disabled
                ? "AI Intelligence is unavailable"
                : "Ask about requests, suppliers, or performance..."
            }
            className="min-h-[3rem] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/60"
          />
          <button
            type="submit"
            disabled={disabled || sending || !draft.trim()}
            aria-label="Send question"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={17} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-right text-xs text-slate-400">
          {draft.length}/{AI_MESSAGE_MAX_LENGTH}
        </p>
      </form>
    </div>
  );
};

export default AiConversation;