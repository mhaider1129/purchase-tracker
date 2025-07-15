// src/components/Navbar.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCurrentUser from '../hooks/useCurrentUser';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
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
      className={`${color} font-semibold text-left`}
    >
      {label}
    </button>
  );

  const NavItems = () => {
    if (!user) return null;

    return (
      <>
        {renderNavButton('Open Requests', '/open-requests', 'text-green-600')}

        {user.role === 'technician' &&
          renderNavButton('My Maintenance Requests', '/my-maintenance-requests', 'text-orange-600')}

        {user.role === 'requester' &&
          renderNavButton('Maintenance Approvals', '/maintenance-approvals', 'text-amber-600')}

        {renderNavButton('Closed Requests', '/closed-requests', 'text-gray-600')}

        {(user.role === 'admin' || user.role === 'SCM') && (
          <>
            {renderNavButton('Admin Tools', '/admin-tools', 'text-yellow-600')}
            {renderNavButton('Management', '/management', 'text-purple-600')}
            {renderNavButton('All Requests', '/all-requests', 'text-indigo-600')}
          </>
        )}

        {['admin', 'SCM', 'CMO', 'COO'].includes(user.role) &&
          renderNavButton(
            'View Incomplete Requests',
            user.role === 'CMO'
              ? '/incomplete/medical'
              : user.role === 'COO'
              ? '/incomplete/operational'
              : '/incomplete',
            'text-orange-600'
          )}

        {['CEO', 'ProcurementSupervisor'].includes(user.role) &&
          renderNavButton('Register User', '/register', 'text-blue-600')}

        {['ProcurementSpecialist', 'ProcurementSupervisor', 'SCM'].includes(user.role) && (
          <>
            {renderNavButton('My Assigned Requests', '/assigned-requests', 'text-purple-600')}
            {renderNavButton('Completed Requests', '/completed-assigned', 'text-gray-700')}
          </>
        )}

        {/* 🔐 User Info Card */}
        <div
          className="flex items-center gap-2 bg-white px-3 py-1 rounded shadow w-fit mt-2"
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

        {renderNavButton('Logout', '/login', 'text-red-600')}
      </>
    );
  };

  return (
    <nav className="bg-gray-200 shadow-sm" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <h1
          className="text-xl font-bold cursor-pointer"
          onClick={() => navigate('/')}
        >
          Purchase Tracker
        </h1>

        <button
          className="md:hidden text-gray-700"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="hidden md:flex items-center gap-4">
          <NavItems />
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
