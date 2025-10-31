import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationContext } from './NotificationProvider';

const typeIcons = {
  success: (
    <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-300" aria-hidden="true" />
  ),
  error: <XCircle className="h-4 w-4 text-red-500 dark:text-red-300" aria-hidden="true" />,
  warning: (
    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-300" aria-hidden="true" />
  ),
  info: <Info className="h-4 w-4 text-sky-500 dark:text-sky-300" aria-hidden="true" />,
};

const NotificationBell = () => {
  const { t } = useTranslation();
  const { notifications, remove, clearAll } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const hasNotifications = notifications.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClick = (event) => {
      if (!panelRef.current || !buttonRef.current) return;

      if (
        !panelRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);

    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (notifications.length === 0) {
      setIsOpen(false);
    }
  }, [notifications.length]);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.id - a.id),
    [notifications],
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/80 p-2 text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700"
        aria-label={t('navbar.openNotifications', 'Open notifications')}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {hasNotifications ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white shadow">
            {notifications.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          className="absolute right-0 z-[1001] mt-2 w-80 max-w-xs origin-top-right rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
          role="dialog"
          aria-label={t('navbar.notifications')}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('navbar.notifications')}
            </p>
            {hasNotifications ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-blue-600 transition hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {t('navbar.clearAll')}
              </button>
            ) : null}
          </div>

          {hasNotifications ? (
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {sortedNotifications.map(({ id, message, title, type }) => {
                const icon = typeIcons[type] ?? typeIcons.info;

                return (
                  <li
                    key={id}
                    className="rounded-md border border-gray-200 bg-white/90 p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{icon}</div>
                      <div className="flex-1">
                        {title ? (
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-100">
                            {title}
                          </p>
                        ) : null}
                        <p className="text-xs text-gray-600 dark:text-gray-300">{message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(id)}
                        className="text-xs font-medium text-gray-400 transition hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        aria-label={t('navbar.dismissNotification', 'Dismiss notification')}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('navbar.noNotifications')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;