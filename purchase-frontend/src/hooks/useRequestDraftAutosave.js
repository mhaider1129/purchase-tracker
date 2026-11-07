import { useCallback, useEffect, useRef, useState } from "react";

const hasBrowserStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
};

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
  const timerRef = useRef(null);
  const clearedRef = useRef(false);
  const restoreDraftRef = useRef(restoreDraft);
  // Depend on the serializable value, not a caller's object identity. Status
  // updates must not restart a cleared timer or overwrite a storage error.
  let serializedData;
  try {
    serializedData = JSON.stringify(data);
  } catch {
    serializedData = null;
  }

  useEffect(() => {
    restoreDraftRef.current = restoreDraft;
  }, [restoreDraft]);

  useEffect(() => {
    if (!enabled || hydratedRef.current || !hasBrowserStorage()) return;

    let rawDraft;
    try {
      rawDraft = window.localStorage.getItem(storageKey);
    } catch {
      setStatus("error");
      return;
    }
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
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          setStatus("error");
        }
      }
    }

    hydratedRef.current = true;
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current || !hasBrowserStorage())
      return undefined;

    if (!serializedData) {
      setStatus("error");
      return undefined;
    }
    setStatus("saving");
    clearedRef.current = false;
    const timeoutId = window.setTimeout(() => {
      if (clearedRef.current) return;
      try {
        const savedAt = new Date();
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...JSON.parse(serializedData),
            updatedAt: savedAt.toISOString(),
          }),
        );
        setLastSavedAt(savedAt);
        setStatus("saved");
      } catch (error) {
        console.warn(`Unable to save request draft to ${storageKey}.`, error);
        setStatus("error");
      }
    }, debounceMs);

    timerRef.current = timeoutId;
    return () => window.clearTimeout(timeoutId);
  }, [serializedData, debounceMs, enabled, storageKey]);

  const clearDraft = useCallback(() => {
    clearedRef.current = true;
    window.clearTimeout(timerRef.current);
    if (hasBrowserStorage()) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        setStatus("error");
      }
    }
    setLastSavedAt(null);
    setStatus("idle");
  }, [storageKey]);

  const saveDraft = useCallback(() => {
    if (!enabled) return;
    if (!hasBrowserStorage()) {
      setStatus("error");
      return;
    }
    window.clearTimeout(timerRef.current);
    try {
      const savedAt = new Date();
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...JSON.parse(serializedData),
          updatedAt: savedAt.toISOString(),
        }),
      );
      setLastSavedAt(savedAt);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [serializedData, enabled, storageKey]);

  return {
    saveDraft,
    clearDraft,
    isSaving: status === "saving",
    lastSavedAt,
    lastSavedLabel: formatSavedTime(lastSavedAt),
    status,
  };
};

export default useRequestDraftAutosave;
