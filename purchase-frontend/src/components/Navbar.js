// src/components/Navbar.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCurrentUser from '../hooks/useCurrentUser';
import useDarkMode from '../hooks/useDarkMode';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const getInitials = (name) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase();

  const renderNavButton = (label, path, color = 'text-black') => {
    const isActive =
      location.pathname === path ||
      (path !== '/' && location.pathname.startsWith(`${path}/`));

    const baseClasses =
      'flex items-center gap-2 font-semibold text-sm md:text-base px-3 py-2 rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

    const activeClasses =
      'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-300';
    const inactiveClasses = `${color} hover:bg-gray-200 dark:hover:bg-gray-700`;

    return (
      <button
        type="button"
        onClick={() => navigate(path)}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {label}
      </button>
    );
  };

  const NavItems = () => {
    if (!user) return null;

    return (
      <>
        {renderNavButton(t('navbar.openRequests'), '/open-requests', 'text-green-600')}

        {user.role === 'technician' &&
          renderNavButton(t('navbar.myMaintenance'), '/my-maintenance-requests', 'text-orange-600')}

        {renderNavButton(t('navbar.closedRequests'), '/closed-requests', 'text-gray-600')}

        {user.role === 'audit' &&
          renderNavButton(t('navbar.auditRequests'), '/audit-requests', 'text-blue-600')}

        {[
          'WarehouseManager',
          'warehouse_manager',
          'WarehouseKeeper',
          'warehouse_keeper',
          'warehousekeeper',
          'SCM',
          'admin',
        ].includes(user.role) &&
          renderNavButton(t('navbar.custodyIssue'), '/custody/issue', 'text-indigo-600')}

        {['WarehouseManager', 'warehouse_manager', 'technician'].includes(user.role) &&
          renderNavButton(t('navbar.maintenanceStock'), '/maintenance-stock', 'text-teal-600')}

        {(user.role === 'admin' || user.role === 'SCM') && (
          <>
            {renderNavButton(t('navbar.dashboard'), '/dashboard', 'text-cyan-600')}
            {renderNavButton(t('navbar.lifecycleAnalytics'), '/analytics', 'text-pink-600')}
            {renderNavButton(t('navbar.adminTools'), '/admin-tools', 'text-yellow-600')}
            {renderNavButton(t('navbar.management'), '/management', 'text-purple-600')}
            {renderNavButton(t('navbar.allRequests'), '/all-requests', 'text-indigo-600')}
            {renderNavButton(t('navbar.procurementPlans'), '/procurement-plans', 'text-teal-600')}
          </>
        )}

        {['admin', 'SCM', 'CMO', 'COO'].includes(user.role) &&
          renderNavButton(
            t('navbar.viewIncomplete'),
            user.role === 'CMO'
              ? '/incomplete/medical'
              : user.role === 'COO'
              ? '/incomplete/operational'
              : '/incomplete',
            'text-orange-600'
          )}

        {['CEO', 'ProcurementSupervisor'].includes(user.role) &&
          renderNavButton(t('navbar.registerUser'), '/register', 'text-blue-600')}

        {['ProcurementSpecialist', 'ProcurementSupervisor', 'SCM'].includes(user.role) && (
          <>
            {renderNavButton(t('navbar.myAssigned'), '/assigned-requests', 'text-purple-600')}
            {renderNavButton(t('navbar.completedRequests'), '/completed-assigned', 'text-gray-700')}
          </>
        )}

        {renderNavButton(t('navbar.custodyApprovals'), '/custody/approvals', 'text-indigo-600')}

        {renderNavButton(t('navbar.changePassword'), '/change-password', 'text-blue-600')}

        <div
          className="flex items-center gap-2 bg-white/80 dark:bg-gray-700 dark:text-gray-100 px-3 py-1 rounded shadow w-fit mt-2"
          role="contentinfo"
        >
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white flex items-center justify-center font-bold text-sm"
            title={user.name}
          >
            {getInitials(user.name)}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-200 font-medium leading-tight">
            {user.name}
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">({user.role})</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-red-600 dark:text-red-400 font-semibold text-center px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {t('navbar.logout')}
        </button>
      </>
    );
  };

  return (
    <nav
      className="sticky top-0 z-50 bg-gray-100/90 dark:bg-gray-900/90 dark:text-gray-100 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="w-full px-4 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl md:text-2xl font-semibold tracking-tight cursor-pointer text-blue-700 dark:text-blue-300"
            onClick={() => navigate('/')}
          >
            {t('navbar.purchaseTracker')}
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden lg:flex items-center justify-center gap-3 flex-wrap">
            <NavItems />
          </div>
          <div className="flex items-center gap-2 bg-white/70 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 backdrop-blur">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent text-sm text-gray-700 dark:text-gray-200 focus:outline-none"
              aria-label={t('navbar.selectLanguage')}
            >
              <option value="en">{t('language.english')}</option>
              <option value="ar">{t('language.arabic')}</option>
            </select>
            <span className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
            <button
              type="button"
              onClick={toggleDarkMode}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              aria-label={darkMode ? t('navbar.lightMode') : t('navbar.darkMode')}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <button
            className="lg:hidden inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={t('navbar.toggleMenu')}
            aria-expanded={isOpen}
            type="button"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden flex flex-col gap-3 px-4 pb-4 pt-2 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-800 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {t('navbar.navigation')}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-blue-600 dark:text-blue-300 font-medium"
            >
              {t('navbar.closeMenu')}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <NavItems />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;