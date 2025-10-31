import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const NotificationContext = createContext(null);
let notificationId = 0;

const typeStyles = {
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-700/60 dark:bg-green-900/40 dark:text-green-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-900/40 dark:text-red-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/40 dark:text-amber-100',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/40 dark:text-sky-100',
};

const NotificationPortal = ({ notifications, onDismiss }) => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[1000] flex w-full max-w-sm flex-col gap-3 p-2 sm:max-w-md">
      {notifications.map(({ id, message, title, type }) => {
        const appearance = typeStyles[type] || typeStyles.info;

        return (
          <div
            key={id}
            className={`relative overflow-hidden rounded-lg border shadow-lg transition-opacity duration-300 ${appearance}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1">
                {title ? <p className="text-sm font-semibold">{title}</p> : null}
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

export const NotificationProvider = ({ children, timeout = 5000 }) => {
  const [notifications, setNotifications] = useState([]);
  const timers = useRef(new Map());

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));

    const timeoutId = timers.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timers.current.delete(id);
    }
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    timers.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    timers.current.clear();
  }, []);

  const notify = useCallback(
    ({ message, title, type = 'info', duration }) => {
      if (!message) {
        return null;
      }

      const id = ++notificationId;
      const timeoutDuration = duration ?? timeout;

      setNotifications((prev) => [...prev, { id, message, title, type }]);

      if (timeoutDuration !== null && typeof timeoutDuration === 'number' && timeoutDuration > 0) {
        const timeoutId = window.setTimeout(() => removeNotification(id), timeoutDuration);
        timers.current.set(id, timeoutId);
      }

      return id;
    },
    [removeNotification, timeout],
  );

  const contextValue = useMemo(
    () => ({
      notify,
      remove: removeNotification,
      clearAll: clearAllNotifications,
      notifications,
    }),
    [notify, removeNotification, clearAllNotifications, notifications],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationPortal notifications={notifications} onDismiss={removeNotification} />
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }

  return context;
};