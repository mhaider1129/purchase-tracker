// src/components/Navbar.js
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import { Menu, X, Sun, Moon, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import NotificationBell from "./ui/NotificationBell";
import { useAuth } from "../hooks/useAuth";
import { useAccessControl } from "../hooks/useAccessControl";

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { hasAccess } = useAccessControl();
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const [isTouchInteraction, setIsTouchInteraction] = useState(false);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handlePointerDown = (event) => {
      setIsTouchInteraction(event.pointerType === "touch");
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const handleGroupMouseEnter = (groupId) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setOpenGroup(groupId);
  };

  const handleGroupMouseLeave = (groupId) => {
    if (isTouchInteraction) {
      return;
    }

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setOpenGroup((current) => (current === groupId ? null : current));
      hoverTimeoutRef.current = null;
    }, 150);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    logout();
  };

  const getInitials = (name) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const renderNavButton = (
    label,
    path,
    color = "text-black",
    extraClasses = "",
  ) => {
    const isActive =
      location.pathname === path ||
      (path !== "/" && location.pathname.startsWith(`${path}/`));

    const baseClasses =
      "flex items-center gap-2 font-semibold text-sm md:text-base px-3 py-2 rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900";

    const activeClasses =
      "bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-300";
    const inactiveClasses = `${color} hover:bg-gray-200 dark:hover:bg-gray-700`;

    return (
      <button
        type="button"
        onClick={() => navigate(path)}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${extraClasses}`}
        aria-current={isActive ? "page" : undefined}
      >
        {label}
      </button>
    );
  };

  const NavItems = ({ variant = "desktop" }) => {
    if (isLoading || !user) return null;

    const normalizedRole = user.role?.toLowerCase?.() ?? "";
    const currentUser = user;

    const canViewAllRequests = hasAccess(currentUser, "feature.allRequests", [
      "requests.view-all",
    ]);
    const canManageProcurement = hasAccess(
      currentUser,
      "feature.procurementPlans",
      ["procurement.update-status", "procurement.update-cost"],
    );
    const canHandleProcurementQueues = hasAccess(
      currentUser,
      "feature.procurementQueues",
      ["procurement.update-status"],
    );
    const canAccessCustody = hasAccess(currentUser, "feature.custody", [
      "warehouse.manage-supply",
    ]);
    const canAccessMaintenanceStock = hasAccess(
      currentUser,
      "feature.maintenanceStock",
      ["warehouse.manage-supply"],
    );
    const canManageTechnicalInspections = hasAccess(
      currentUser,
      "feature.technicalInspections",
      ["warehouse.manage-supply"],
    );
    const canManageWarehouseInventory = hasAccess(
      currentUser,
      "feature.warehouseInventory",
      ["warehouse.manage-supply", "warehouse.view-supply"],
      true,
    );
    const canViewRecalls = hasAccess(currentUser, "feature.itemRecalls", [
      "recalls.view",
      "recalls.manage",
    ]);
    const canUseAdminTools = hasAccess(currentUser, "feature.adminTools", [
      "approvals.reassign",
    ]);
    const canAccessManagement = hasAccess(currentUser, "feature.management", [
      "users.manage",
      "departments.manage",
      "permissions.manage",
      "projects.manage",
    ]);
    const canViewDashboard = hasAccess(currentUser, "feature.dashboard", [
      "dashboard.view",
    ]);
    const canViewAnalytics = hasAccess(currentUser, "feature.analytics", [
      "dashboard.view",
    ]);
    const canManageContracts = hasAccess(currentUser, "feature.contracts", [
      "contracts.manage",
    ]);
    const canManageEvaluations = hasAccess(
      currentUser,
      "feature.supplierEvaluations",
      ["evaluations.manage"],
    );
    const canAccessAudit = hasAccess(currentUser, "feature.auditRequests", [
      "requests.view-all",
    ]);
    const canReviewStockItems = hasAccess(
      currentUser,
      "feature.stockItemApprovals",
      ["stock-requests.review", "stock-items.manage"],
    );
    const canViewIncompleteQueues =
      hasAccess(currentUser, "feature.incompleteRequests", [
        "requests.view-incomplete",
      ]) || ["cmo", "coo"].includes(normalizedRole);

    const incompletePath =
      normalizedRole === "cmo"
        ? "/incomplete/medical"
        : normalizedRole === "coo"
          ? "/incomplete/operational"
          : "/incomplete";

    const createItem = (condition, label, path, color) =>
      condition ? { label, path, color } : null;

    const navGroups = [
      {
        id: "requests",
        label: t("navbar.groups.requests"),
        items: [
          createItem(
            true,
            t("navbar.openRequests"),
            "/open-requests",
            "text-green-600",
          ),
          createItem(
            normalizedRole === "technician",
            t("navbar.myMaintenance"),
            "/my-maintenance-requests",
            "text-orange-600",
          ),
          createItem(
            true,
            t("navbar.closedRequests"),
            "/closed-requests",
            "text-gray-600",
          ),
          createItem(
            canViewAllRequests,
            t("navbar.allRequests"),
            "/all-requests",
            "text-indigo-600",
          ),
          createItem(
            canManageProcurement,
            t("navbar.procurementPlans"),
            "/procurement-plans",
            "text-teal-600",
          ),
          createItem(
            canHandleProcurementQueues,
            t("navbar.myAssigned"),
            "/assigned-requests",
            "text-purple-600",
          ),
          createItem(
            canHandleProcurementQueues,
            t("navbar.completedRequests"),
            "/completed-assigned",
            "text-gray-700",
          ),
        ].filter(Boolean),
      },
      {
        id: "operations",
        label: t("navbar.groups.operations"),
        items: [
          createItem(
            canAccessCustody,
            t("navbar.custodyIssue"),
            "/custody/issue",
            "text-indigo-600",
          ),
          createItem(
            canAccessCustody,
            t("navbar.custodyIssued"),
            "/custody/issued",
            "text-indigo-500",
          ),
          createItem(
            canAccessMaintenanceStock,
            t("navbar.maintenanceStock"),
            "/maintenance-stock",
            "text-teal-600",
          ),
          createItem(
            canManageTechnicalInspections,
            t("navbar.technicalInspections"),
            "/technical-inspections",
            "text-emerald-600",
          ),
          createItem(
            canManageWarehouseInventory,
            t("navbar.warehouseInventory"),
            "/warehouse-inventory",
            "text-blue-700",
          ),
          createItem(
            canReviewStockItems,
            t("navbar.stockItemApprovals"),
            "/stock-item-approvals",
            "text-blue-700",
          ),
          createItem(
            canViewRecalls,
            t("navbar.itemRecalls"),
            "/item-recalls",
            "text-amber-600",
          ),
          createItem(
            canAccessAudit,
            t("navbar.auditRequests"),
            "/audit-requests",
            "text-blue-600",
          ),
        ].filter(Boolean),
      },
      {
        id: "insights",
        label: t("navbar.groups.insights"),
        items: [
          createItem(
            canViewDashboard,
            t("navbar.dashboard"),
            "/dashboard",
            "text-cyan-600",
          ),
          createItem(
            canViewAnalytics,
            t("navbar.lifecycleAnalytics"),
            "/analytics",
            "text-pink-600",
          ),
          createItem(
            canUseAdminTools,
            t("navbar.adminTools"),
            "/admin-tools",
            "text-yellow-600",
          ),
          createItem(
            canAccessManagement,
            t("navbar.management"),
            "/management",
            "text-purple-600",
          ),
        ].filter(Boolean),
      },
      {
        id: "governance",
        label: t("navbar.groups.governance"),
        items: [
          createItem(
            canManageEvaluations,
            t("navbar.supplierEvaluations"),
            "/supplier-evaluations",
            "text-emerald-700",
          ),
          createItem(
            canViewIncompleteQueues,
            t("navbar.viewIncomplete"),
            incompletePath,
            "text-orange-600",
          ),
          createItem(
            canManageContracts,
            t("navbar.contracts"),
            "/contracts",
            "text-emerald-600",
          ),
          createItem(
            normalizedRole === "ceo",
            t("navbar.registerUser"),
            "/register",
            "text-blue-600",
          ),
        ].filter(Boolean),
      },
      {
        id: "account",
        label: t("navbar.groups.account"),
        items: [
          createItem(
            true,
            t("navbar.myEvaluations"),
            "/my-evaluations",
            "text-blue-600",
          ),
          createItem(
            true,
            t("navbar.changePassword"),
            "/change-password",
            "text-blue-600",
          ),
        ],
      },
    ].filter((group) => group.items.length > 0);

    const renderProfileCard = () => (
      <div
        className="mt-2 flex w-fit items-center gap-2 rounded bg-white/80 px-3 py-1 text-gray-700 shadow dark:bg-gray-700 dark:text-gray-100 lg:mt-0"
        role="contentinfo"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-sm font-bold text-white"
          title={user.name}
        >
          {getInitials(user.name)}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {user.name}
          </div>
          <div className="text-xs italic text-gray-500 dark:text-gray-400">
            ({user.role})
          </div>
        </div>
      </div>
    );

    const renderLogoutButton = () => (
      <button
        onClick={handleLogout}
        className="text-red-600 transition-colors hover:bg-gray-200 dark:text-red-400 dark:hover:bg-gray-700 rounded px-3 py-2 font-semibold text-center"
      >
        {t("navbar.logout")}
      </button>
    );

    if (variant === "desktop") {
      return (
        <>
          {navGroups.map((group) => (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => handleGroupMouseEnter(group.id)}
              onMouseLeave={() => handleGroupMouseLeave(group.id)}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((current) =>
                    current === group.id ? null : group.id,
                  )
                }
                onMouseEnter={() => handleGroupMouseEnter(group.id)}
                onFocus={() => handleGroupMouseEnter(group.id)}
                className="flex items-center gap-1 rounded-md bg-white/70 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800/70 dark:text-gray-100 dark:hover:bg-gray-800"
                aria-haspopup="true"
                aria-expanded={openGroup === group.id}
              >
                {group.label}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${openGroup === group.id ? "rotate-180" : "rotate-0"}`}
                  aria-hidden="true"
                />
              </button>
              <div
                role="menu"
                className={`absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-gray-200 bg-white/95 p-2 shadow-lg transition-all dark:border-gray-700 dark:bg-gray-900/95 ${
                  openGroup === group.id
                    ? "visible translate-y-0 opacity-100"
                    : "invisible -translate-y-1 opacity-0"
                }`}
                onMouseEnter={() => handleGroupMouseEnter(group.id)}
                onMouseLeave={() => handleGroupMouseLeave(group.id)}
              >
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <div key={item.path}>
                      {renderNavButton(
                        item.label,
                        item.path,
                        item.color,
                        "w-full text-left",
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {renderProfileCard()}
          {renderLogoutButton()}
        </>
      );
    }

    return (
      <>
        {navGroups.map((group) => (
          <div
            key={group.id}
            className="flex flex-col gap-2 rounded-md border border-gray-200/70 bg-white/80 p-3 dark:border-gray-700/70 dark:bg-gray-800/80"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {group.label}
            </span>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <div key={item.path}>
                  {renderNavButton(
                    item.label,
                    item.path,
                    item.color,
                    "w-full text-left",
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {renderProfileCard()}
        {renderLogoutButton()}
      </>
    );
  };

  return (
    <nav
      className="sticky top-0 z-50 border-b border-gray-200 bg-gray-100/90 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-100"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex w-full items-center justify-between px-4 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <h1
            className="cursor-pointer text-xl font-semibold tracking-tight text-blue-700 dark:text-blue-300 md:text-2xl"
            onClick={() => navigate("/")}
          >
            {t("navbar.purchaseTracker")}
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden flex-wrap items-center justify-center gap-3 lg:flex">
            <NavItems variant="desktop" />
          </div>
          <NotificationBell />
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-2 py-1 backdrop-blur dark:border-gray-700 dark:bg-gray-800/80">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent text-sm text-gray-700 focus:outline-none dark:text-gray-200"
              aria-label={t("navbar.selectLanguage")}
            >
              <option value="en">{t("language.english")}</option>
              <option value="ar">{t("language.arabic")}</option>
            </select>
            <span
              className="h-4 w-px bg-gray-300 dark:bg-gray-600"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={toggleDarkMode}
              className="text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-300"
              aria-label={
                darkMode ? t("navbar.lightMode") : t("navbar.darkMode")
              }
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-md border border-gray-300 p-2 text-gray-700 transition hover:bg-gray-200 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 lg:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={t("navbar.toggleMenu")}
            aria-expanded={isOpen}
            type="button"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-gray-200 bg-white/95 px-4 pb-4 pt-2 shadow-inner dark:border-gray-800 dark:bg-gray-900/95 lg:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              {t("navbar.navigation")}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-blue-600 dark:text-blue-300"
            >
              {t("navbar.closeMenu")}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <NavItems variant="mobile" />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
