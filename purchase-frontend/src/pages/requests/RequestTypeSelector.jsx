// src/pages/requests/RequestTypeSelector.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axios from '../../api/axios';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const RequestTypeSelector = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({
    role: '',
    department_id: null,
    department_name: '',
    section_id: null,
    can_request_medication: false,
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get('/api/users/me');
        setUserInfo({
          role: res.data.role?.toLowerCase(),
          department_id: res.data.department_id,
          department_name: res.data.department_name?.toLowerCase() || '',
          section_id: res.data.section_id || null,
          can_request_medication: res.data.can_request_medication || false,
        });
      } catch (err) {
        console.error('❌ Failed to load user info:', err);
        alert('Failed to load your user data. Please try again.');
      }
    };

    fetchUserInfo();
  }, []);

  const { role } = userInfo;

  const buttonStyle =
    'block w-full py-2 px-4 rounded text-white font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2';

  return (
    <>
      <Navbar />
      <div className="max-w-md mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Select Request Type
          <HelpTooltip text="Step 1: Choose the type of request you want to submit." />
        </h1>

        <div className="space-y-4">
          {/* 📦 Stock Request */}
          {['warehousemanager', 'warehouse_manager', 'warehouse_keeper'].includes(role) && (
            <button
              onClick={() => navigate('/requests/stock')}
              className={`${buttonStyle} bg-blue-600 hover:bg-blue-700 focus:ring-blue-400`}
              aria-label="Stock Request"
            >
              Stock Request
            </button>
          )}

          {['warehousemanager', 'warehouse_manager'].includes(role) && (
            <button
              onClick={() => navigate('/requests/stock-item')}
              className={`${buttonStyle} bg-blue-600 hover:bg-blue-700 focus:ring-blue-400`}
              aria-label="New Stock Item"
            >
              New Stock Item
            </button>
          )}

          {['warehousemanager', 'warehouse_manager', 'warehouse_keeper'].includes(role) && (
            <button
              onClick={() => navigate('/warehouse-supply-templates')}
              className={`${buttonStyle} bg-blue-600 hover:bg-blue-700 focus:ring-blue-400`}
              aria-label="Manage Warehouse Supply Templates"
            >
              Warehouse Supply Templates
            </button>
          )}

          {['warehousemanager', 'warehouse_manager', 'warehouse_keeper'].includes(role) && (
            <button
              onClick={() => navigate('/warehouse-supply-requests')}
              className={`${buttonStyle} bg-blue-500 hover:bg-blue-600 focus:ring-blue-300`}
              aria-label="View Warehouse Supply Requests"
            >
              Submitted Warehouse Supply Requests
            </button>
          )}

          <button
            onClick={() => navigate('/requests/warehouse-supply')}
            className={`${buttonStyle} bg-blue-500 hover:bg-blue-600 focus:ring-blue-300`}
            aria-label="Warehouse Supply Request"
          >
            Warehouse Supply Request
          </button>

          {/* 📑 Non-Stock + Medical Device */}
          <button
            onClick={() => navigate('/requests/non-stock')}
            className={`${buttonStyle} bg-green-600 hover:bg-green-700 focus:ring-green-400`}
            aria-label="Non-Stock Request"
          >
            Non-Stock Request
          </button>

          <button
            onClick={() => navigate('/requests/medical-device')}
            className={`${buttonStyle} bg-purple-600 hover:bg-purple-700 focus:ring-purple-400`}
            aria-label="Medical Device Request"
          >
            Medical Device Request
          </button>

          {userInfo.can_request_medication && (
            <button
              onClick={() => navigate('/requests/medication')}
              className={`${buttonStyle} bg-pink-600 hover:bg-pink-700 focus:ring-pink-400`}
              aria-label="Medication Request"
            >
              Medication Request
            </button>
          )}

          <button
            onClick={() => navigate('/requests/it-items')}
            className={`${buttonStyle} bg-teal-600 hover:bg-teal-700 focus:ring-teal-400`}
            aria-label="IT Item Request"
          >
            IT Item Request
          </button>

          {/* 🔎 Approval Panel & History */}
          {['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'warehousemanager', 'warehouse_manager'].includes(role) && (
            <button
              onClick={() => navigate('/approvals')}
              className={`${buttonStyle} bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400`}
              aria-label="Approvals Panel"
            >
              Approvals Panel
            </button>
          )}

          {['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'admin', 'warehousemanager', 'warehouse_manager'].includes(role) && (
            <button
              onClick={() => navigate('/approval-history')}
              className={`${buttonStyle} bg-gray-700 hover:bg-gray-800 focus:ring-gray-400`}
              aria-label="Approval History"
            >
              Approval History
            </button>
          )}

          {/* 👤 Admin Functions */}
          {['admin', 'scm'].includes(role) && (
            <button
              onClick={() => navigate('/register')}
              className={`${buttonStyle} bg-yellow-500 hover:bg-yellow-600 mt-6 text-gray-900 focus:ring-yellow-300`}
              aria-label="Register New User"
            >
              Register New User
            </button>
          )}

          {/* 🛠 Maintenance Paths */}
          {role === 'technician' && (
            <button
              onClick={() => navigate('/requests/maintenance')}
              className={`${buttonStyle} bg-red-600 hover:bg-red-700 focus:ring-red-400`}
              aria-label="Maintenance Request"
            >
              Maintenance Request
            </button>
          )}

          {role === 'technician' && (
            <button
              onClick={() => navigate('/requests/maintenance-warehouse-supply')}
              className={`${buttonStyle} bg-blue-500 hover:bg-blue-600 focus:ring-blue-300`}
              aria-label="Maintenance Warehouse Supply Request"
            >
              Maintenance Warehouse Supply Request
            </button>
          )}

          {['hod', 'requester', 'cmo', 'coo', 'scm'].includes(role) && (
            <button
              onClick={() => navigate('/approvals/maintenance')}
              className={`${buttonStyle} bg-orange-700 hover:bg-orange-800 focus:ring-orange-400`}
              aria-label="Maintenance Approvals"
            >
              Maintenance Approvals
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default RequestTypeSelector;