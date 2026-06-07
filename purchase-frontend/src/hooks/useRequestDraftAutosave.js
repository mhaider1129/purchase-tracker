import { useCallback, useEffect, useRef, useState } from "react";

const hasBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const formatSavedTime = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

/**
 * Keeps a request form recoverable by saving its serializable fields locally.
 * File inputs cannot be restored by browsers, so callers should exclude File values.
 */
const useRequestDraftAutosave = ({
  storageKey,
  data,
  restoreDraft,
  enabled = true,
  debounceMs = 600,
}) => {
  const [status, setStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const hydratedRef = useRef(false);
  const restoreDraftRef = useRef(restoreDraft);

  useEffect(() => {
    restoreDraftRef.current = restoreDraft;
  }, [restoreDraft]);

  useEffect(() => {
    if (!enabled || hydratedRef.current || !hasBrowserStorage()) return;

    const rawDraft = window.localStorage.getItem(storageKey);
    if (rawDraft) {
      try {
        const parsedDraft = JSON.parse(rawDraft);
        restoreDraftRef.current?.(parsedDraft);
        setStatus("restored");
        if (parsedDraft?.updatedAt) {
          const parsedDate = new Date(parsedDraft.updatedAt);
          if (!Number.isNaN(parsedDate.getTime())) {
            setLastSavedAt(parsedDate);
          }
        }
      } catch (error) {
        console.warn(
          `Unable to restore request draft from ${storageKey}.`,
          error,
        );
        window.localStorage.removeItem(storageKey);
      }
    }

    hydratedRef.current = true;
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current || !hasBrowserStorage())
      return undefined;

    setStatus("saving");
    const timeoutId = window.setTimeout(() => {
      try {
        const savedAt = new Date();
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ ...data, updatedAt: savedAt.toISOString() }),
        );
        setLastSavedAt(savedAt);
        setStatus("saved");
      } catch (error) {
        console.warn(`Unable to save request draft to ${storageKey}.`, error);
        setStatus("error");
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [data, debounceMs, enabled, storageKey]);

  const clearDraft = useCallback(() => {
    if (hasBrowserStorage()) {
      window.localStorage.removeItem(storageKey);
    }
    setLastSavedAt(null);
    setStatus("idle");
  }, [storageKey]);

  return {
    clearDraft,
    isSaving: status === "saving",
    lastSavedAt,
    lastSavedLabel: formatSavedTime(lastSavedAt),
    status,
  };
};

export default useRequestDraftAutosave;