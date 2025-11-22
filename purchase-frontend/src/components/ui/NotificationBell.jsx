import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useNotificationContext } from "./NotificationProvider";

const typeIcons = {
  success: (
    <CheckCircle2
      className="h-4 w-4 text-green-500 dark:text-green-300"
      aria-hidden="true"
    />
  ),
  error: (
    <XCircle
      className="h-4 w-4 text-red-500 dark:text-red-300"
      aria-hidden="true"
    />
  ),
  warning: (
    <AlertTriangle
      className="h-4 w-4 text-amber-500 dark:text-amber-300"
      aria-hidden="true"
    />
  ),
  info: (
    <Info
      className="h-4 w-4 text-sky-500 dark:text-sky-300"
      aria-hidden="true"
    />
  ),
};

const deriveNotificationVariant = (notification) => {
  if (!notification) return "info";

  const metadata = notification.metadata || {};
  const explicit = metadata.level || metadata.variant || metadata.type;
  if (explicit && typeIcons[explicit]) {
    return explicit;
  }

  const action =
    typeof metadata.action === "string" ? metadata.action.toLowerCase() : "";
  const title =
    typeof notification.title === "string"
      ? notification.title.toLowerCase()
      : "";
  const message =
    typeof notification.message === "string"
      ? notification.message.toLowerCase()
      : "";
  const combined = `${title} ${message} ${action}`;

  if (
    combined.includes("reject") ||
    combined.includes("declin") ||
    combined.includes("fail")
  ) {
    return "error";
  }

  if (
    combined.includes("approve") ||
    combined.includes("complete") ||
    combined.includes("success")
  ) {
    return "success";
  }

  if (
    combined.includes("urgent") ||
    combined.includes("reminder") ||
    combined.includes("due")
  ) {
    return "warning";
  }

  return "info";
};

const formatTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString();
};

const resolveNotificationDestination = (notification) => {
  const metadata = notification?.metadata || {};
  const rawLink = notification?.link;
  const linkRequestId = (() => {
    if (!rawLink || typeof rawLink !== "string") {
      return null;
    }

    try {
      const parsedUrl = new URL(rawLink, window.location.origin);
      const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");
      const match = normalizedPath.match(/^\/requests\/(\d+)$/i);
      return match ? match[1] : null;
    } catch (error) {
      const fallbackMatch = rawLink.match(/^\/requests\/(\d+)$/i);
      return fallbackMatch ? fallbackMatch[1] : null;
    }
  })();
  const requestId =
    metadata.requestId ?? metadata.request_id ?? linkRequestId ?? null;
  const action =
    typeof metadata.action === "string" ? metadata.action.toLowerCase() : "";
  const requestType =
    typeof metadata.requestType === "string"
      ? metadata.requestType.toLowerCase()
      : typeof metadata.request_type === "string"
        ? metadata.request_type.toLowerCase()
        : "";

  const withRequestFocus = (path) => {
    const hasRequestId =
      requestId !== null && requestId !== undefined && requestId !== "";

    if (!hasRequestId) {
      return { path };
    }

    const separator = path.includes("?") ? "&" : "?";
    const encodedId = encodeURIComponent(requestId);

    return {
      path: `${path}${separator}requestId=${encodedId}`,
      options: {
        state: { focusRequestId: Number(requestId) || requestId },
      },
    };
  };

  if (action === "approval_required") {
    if (requestType === "maintenance") {
      return withRequestFocus("/approvals/maintenance");
    }

    return withRequestFocus("/approvals");
  }

  if (
    action === "procurement_assignment" ||
    action === "request_ready_for_assignment"
  ) {
    return withRequestFocus("/open-requests");
  }

  if (
    action === "request_completed" ||
    action === "maintenance_completed" ||
    action === "request_approved" ||
    action === "request_rejected"
  ) {
    return withRequestFocus("/all-requests");
  }

  if (!rawLink || typeof rawLink !== "string") {
    return null;
  }

  try {
    const url = new URL(rawLink, window.location.origin);
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    const requestMatch = normalizedPath.match(/^\/requests\/(\d+)$/i);

    if (requestMatch) {
      return withRequestFocus("/open-requests");
    }

    return {
      path: `${url.pathname}${url.search}${url.hash}`,
    };
  } catch (error) {
    if (rawLink.startsWith("/")) {
      return { path: rawLink };
    }
  }

  return { external: true, url: rawLink };
};

const NotificationBell = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, remove, clearAll, refresh, isLoading, unreadCount } =
    useNotificationContext();
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

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    refresh({ silent: true });
  }, [isOpen, refresh]);

  useEffect(() => {
    if (notifications.length === 0) {
      setIsOpen(false);
    }
  }, [notifications.length]);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort((a, b) => {
        const left = new Date(a.createdAt || 0).getTime();
        const right = new Date(b.createdAt || 0).getTime();

        if (left === right) {
          return (b.id ?? 0) - (a.id ?? 0);
        }

        return right - left;
      }),
    [notifications],
  );

  const handleNotificationClick = useCallback(
    (notification) => {
      if (!notification) {
        return;
      }

      remove(notification.id);

      const destination = resolveNotificationDestination(notification);

      if (destination?.external && destination.url) {
        setIsOpen(false);
        window.open(destination.url, "_blank", "noopener,noreferrer");
        return;
      }

      if (destination?.path) {
        setIsOpen(false);
        navigate(destination.path, destination.options ?? undefined);
        return;
      }

      if (notification.link) {
        setIsOpen(false);
        navigate(notification.link);
      }
    },
    [navigate, remove],
  );

  const handleDismiss = useCallback(
    (event, id) => {
      event?.stopPropagation();
      remove(id);
    },
    [remove],
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/80 p-2 text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700"
        aria-label={t("navbar.openNotifications", "Open notifications")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white shadow">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          className="absolute right-0 z-[1001] mt-2 w-80 max-w-xs origin-top-right rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
          role="dialog"
          aria-label={t("navbar.notifications")}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t("navbar.notifications")}
            </p>
            {hasNotifications ? (
              <button
                type="button"
                onClick={clearAll}
                disabled={isLoading}
                className="text-xs font-medium text-blue-600 transition hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-blue-300 dark:disabled:text-blue-700"
              >
                {t("navbar.clearAll")}
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("navbar.loadingNotifications", "Loading notifications…")}
            </p>
          ) : null}

          {!isLoading && hasNotifications ? (
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {sortedNotifications.map((notification) => {
                const { id, message, title, link, createdAt } = notification;
                const variant = deriveNotificationVariant(notification);
                const icon = typeIcons[variant] ?? typeIcons.info;
                const timestamp = formatTimestamp(createdAt);

                return (
                  <li
                    key={id}
                    className="rounded-md border border-gray-200 bg-white/90 p-2 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-blue-700/60 dark:hover:bg-blue-900/30"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{icon}</div>
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className="flex w-full flex-col items-start gap-1 text-left focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                          {title ? (
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-100">
                              {title}
                            </p>
                          ) : null}
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {message}
                          </p>
                          {timestamp ? (
                            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                              {timestamp}
                            </span>
                          ) : null}
                          {link ? (
                            <span className="text-[11px] font-medium text-blue-600 underline decoration-dashed underline-offset-4 dark:text-blue-400">
                              {t("navbar.viewDetails", "View details")}
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => handleDismiss(event, id)}
                        className="text-xs font-medium text-gray-400 transition hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        aria-label={t(
                          "navbar.dismissNotification",
                          "Dismiss notification",
                        )}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!isLoading && !hasNotifications ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("navbar.noNotifications")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
