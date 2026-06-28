import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios, { API_ACTION_NOTIFICATION_EVENT } from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";

const NotificationContext = createContext(null);
let toastId = 0;

const toastStyles = {
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-700/60 dark:bg-green-900/40 dark:text-green-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-900/40 dark:text-red-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/40 dark:text-amber-100",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/40 dark:text-sky-100",
};

const playNotificationSound = (type = "info") => {
  if (typeof window === "undefined") return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = type === "error" ? 220 : type === "success" ? 660 : 520;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => context.close();
  } catch (err) {
    console.warn("⚠️ Notification sound could not be played:", err);
  }
};

const ToastPortal = ({ toasts, onDismiss }) => {
  if (typeof document === "undefined") return null;

  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="fixed top-4 right-4 z-[1000] flex w-full max-w-sm flex-col gap-3 p-2 sm:max-w-md">
      {toasts.map(({ id, message, title, type }) => {
        const appearance = toastStyles[type] || toastStyles.info;

        return (
          <div
            key={id}
            className={`relative overflow-hidden rounded-lg border shadow-lg transition-opacity duration-300 ${appearance}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1">
                {title ? (
                  <p className="text-sm font-semibold">{title}</p>
                ) : null}
                <p className="text-sm leading-relaxed">{message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(id)}
                className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-xs font-medium opacity-80 transition hover:bg-black/10 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
};

const normalizeNotification = (candidate) => {
  if (!candidate) return null;

  return {
    id: candidate.id,
    title: candidate.title ?? "",
    message: candidate.message ?? "",
    link: candidate.link ?? null,
    metadata: candidate.metadata ?? null,
    createdAt: candidate.createdAt ?? candidate.created_at ?? null,
    isRead: candidate.isRead ?? candidate.is_read ?? false,
  };
};

export const NotificationProvider = ({
  children,
  toastTimeout = 5000,
  pollInterval = 60000,
}) => {
  const { isAuthenticated } = useAuth();
  const [inbox, setInbox] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const toastTimers = useRef(new Map());
  const pollingRef = useRef(null);
  const isFetchingRef = useRef(false);
  const knownNotificationIdsRef = useRef(new Set());
  const hasLoadedNotificationsRef = useRef(false);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));

    const timeoutId = toastTimers.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      toastTimers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    ({ message, title, type = "info", duration }) => {
      if (!message) {
        return null;
      }

      const id = ++toastId;
      const timeoutDuration = duration ?? toastTimeout;

      setToasts((prev) => [...prev, { id, message, title, type }]);
      playNotificationSound(type);

      if (
        timeoutDuration !== null &&
        typeof timeoutDuration === "number" &&
        timeoutDuration > 0
      ) {
        const timeoutId = window.setTimeout(
          () => dismissToast(id),
          timeoutDuration,
        );
        toastTimers.current.set(id, timeoutId);
      }

      return id;
    },
    [dismissToast, toastTimeout],
  );

  const fetchNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAuthenticated) {
        setInbox([]);
        knownNotificationIdsRef.current.clear();
        hasLoadedNotificationsRef.current = false;
        setError(null);
        return;
      }

      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const response = await axios.get("/notifications", {
          params: { unreadOnly: true, limit: 50 },
        });

        const payload = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];

        const normalized = payload
          .map((item) => normalizeNotification(item))
          .filter(Boolean);

        const knownIds = knownNotificationIdsRef.current;
        const hasLoaded = hasLoadedNotificationsRef.current;
        const newNotifications = normalized.filter(
          (notification) => notification.id && !knownIds.has(notification.id),
        );

        normalized.forEach((notification) => {
          if (notification.id) {
            knownIds.add(notification.id);
          }
        });
        hasLoadedNotificationsRef.current = true;

        if (hasLoaded && newNotifications.length > 0) {
          newNotifications.slice(0, 3).forEach((notification) => {
            pushToast({
              title: notification.title || "New notification",
              message: notification.message,
              type: notification.metadata?.level || notification.metadata?.variant || "info",
            });
          });
        }

        setInbox(normalized);
        setError(null);
      } catch (err) {
        console.error("❌ Failed to load notifications:", err);
        setError(err);
      } finally {
        isFetchingRef.current = false;
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [isAuthenticated, pushToast],
  );

  const markNotificationAsRead = useCallback(
    async (id) => {
      if (!id) {
        return;
      }

      try {
        await axios.patch(`/notifications/${id}/read`);
      } catch (err) {
        console.error("❌ Failed to mark notification as read:", err);
      } finally {
        setInbox((prev) =>
          prev.filter((notification) => notification.id !== id),
        );
        fetchNotifications({ silent: true });
      }
    },
    [fetchNotifications],
  );

  const markAllNotificationsAsRead = useCallback(async () => {
    if (inbox.length === 0) {
      return;
    }

    try {
      await axios.patch("/notifications/read-all");
    } catch (err) {
      console.error("❌ Failed to mark all notifications as read:", err);
    } finally {
      setInbox([]);
      fetchNotifications({ silent: true });
    }
  }, [fetchNotifications, inbox.length]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setInbox([]);
      knownNotificationIdsRef.current.clear();
      hasLoadedNotificationsRef.current = false;
      clearPolling();
      return;
    }

    fetchNotifications();
  }, [isAuthenticated, fetchNotifications, clearPolling]);

  useEffect(() => {
    clearPolling();

    if (!isAuthenticated) {
      return undefined;
    }

    if (
      !pollInterval ||
      typeof pollInterval !== "number" ||
      pollInterval <= 0
    ) {
      return undefined;
    }

    pollingRef.current = window.setInterval(() => {
      fetchNotifications({ silent: true });
    }, pollInterval);

    return () => {
      clearPolling();
    };
  }, [isAuthenticated, pollInterval, fetchNotifications, clearPolling]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleApiAction = (event) => {
      const detail = event.detail || {};
      pushToast({
        title: detail.title,
        message: detail.message,
        type: detail.type || "info",
      });
    };

    window.addEventListener(API_ACTION_NOTIFICATION_EVENT, handleApiAction);

    return () => {
      window.removeEventListener(API_ACTION_NOTIFICATION_EVENT, handleApiAction);
    };
  }, [pushToast]);

  useEffect(
    () => () => {
      clearPolling();
      toastTimers.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      toastTimers.current.clear();
    },
    [clearPolling],
  );

  const contextValue = useMemo(
    () => ({
      notifications: inbox,
      remove: markNotificationAsRead,
      clearAll: markAllNotificationsAsRead,
      refresh: fetchNotifications,
      isLoading,
      error,
      notify: pushToast,
      unreadCount: inbox.length,
    }),
    [
      fetchNotifications,
      inbox,
      isLoading,
      error,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      pushToast,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastPortal toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider",
    );
  }

  return context;
};
