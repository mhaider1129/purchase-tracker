// src/components/Navbar.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCurrentUser from '../hooks/useCurrentUser';
import useDarkMode from '../hooks/useDarkMode';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const getInitials = (name) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase();

  const renderNavButton = (label, path, color = 'text-black') => (
    <button
      onClick={() => {
        navigate(path);
        setIsOpen(false);
      }}
      className={`${color} font-semibold text-center px-3 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors`}    >
      {label}
    </button>
  );

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

        {/* 🔐 User Info Card */}
        <div
          className="flex items-center gap-2 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-1 rounded shadow w-fit mt-2"
          role="contentinfo"
        >
          <div
            className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm"
            title={user.name}
          >
            {getInitials(user.name)}
          </div>
          <div className="text-sm text-gray-700 font-medium">
            {user.name}
            <div className="text-xs text-gray-500 italic">({user.role})</div>
          </div>
        </div>

        <button
          onClick={() => {
            handleLogout();
            setIsOpen(false);
          }}
          className="text-red-600 font-semibold text-center px-3 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {t('navbar.logout')}
        </button>
      </>
    );
  };

  return (
    <nav
      className="bg-gray-200 dark:bg-gray-800 dark:text-gray-100 shadow-sm"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="w-full px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1
            className="text-2xl font-semibold tracking-tight cursor-pointer"
            onClick={() => navigate('/')}
          >
            {t('navbar.purchaseTracker')}
          </h1>

        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="border rounded px-2 py-1 text-sm mr-2"
        >
          <option value="en">{t('language.english')}</option>
          <option value="ar">{t('language.arabic')}</option>
        </select>
        <button
          onClick={toggleDarkMode}
          className="border rounded px-2 py-1 text-sm mr-2"
          aria-label={darkMode ? t('navbar.lightMode') : t('navbar.darkMode')}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center justify-center gap-4 flex-wrap">
            <NavItems />
          </div>
        <button
          className="md:hidden text-gray-700 dark:text-gray-200"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        </div>
      </div>

      {isOpen && (
        <div className="md:hidden flex flex-col gap-3 px-4 pb-4">
          <NavItems />
        </div>
      )}
    </nav>
  );
};

export default Navbar;