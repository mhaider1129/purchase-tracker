import React, { useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import AiConversation from "./AiConversation";

const requestPrompts = [
  "Analyze this request",
  "Explain the current status",
  "Summarize the procurement history",
];

const AiAssistantDrawer = ({ open, onClose, requestId }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-ai-title"
        className="flex h-full w-full flex-col bg-white shadow-2xl dark:bg-slate-900 sm:max-w-xl lg:max-w-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2
              id="request-ai-title"
              className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"
            >
              <Sparkles className="text-blue-600" size={20} /> Analyze with AI
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Request #{requestId} · Supply Chain Intelligence
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close AI analysis"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X />
          </button>
        </header>
        <AiConversation
          compact
          context={{
            page: "request-details",
            entityType: "request",
            entityId: String(requestId),
          }}
          starterPrompts={requestPrompts}
        />
      </section>
    </div>
  );
};

export default AiAssistantDrawer;