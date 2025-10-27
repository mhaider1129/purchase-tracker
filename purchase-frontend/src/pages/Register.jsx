// src/pages/Register.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Navbar from '../components/Navbar';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'requester',
    department_id: '',
    section_id: '', // 🆕 Added section_id
    employee_id: '',
  });

  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 🔐 Role-based Access
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('🔒 You must be logged in to access this page.');
      return navigate('/login');
    }

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const allowedRoles = ['SCM', 'ProcurementSupervisor'];
      if (!allowedRoles.includes(decoded.role)) {
        alert('⛔ Access denied. Only SCM or ProcurementSupervisor can register users.');
        return navigate('/');
      }
    } catch (err) {
      alert('❌ Invalid token. Please login again.');
      localStorage.removeItem('token');
      return navigate('/login');
    }
  }, [navigate]);

  // 📥 Load Departments with Sections
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/api/departments'); // Backend returns sections within departments
        setDepartments(res.data);
      } catch (err) {
        console.error('❌ Failed to load departments:', err);
      }
    };
    fetchDepartments();
  }, []);

  // 🔁 Handle Input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Submit Registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        employee_id: formData.employee_id.trim(),
      };

      if (!payload.employee_id) {
        setMessage('❌ Employee ID is required');
        setLoading(false);
        return;
      }

      await api.post('/auth/register', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('✅ User registered successfully!');
      navigate('/admin/users'); // Optional: Adjust destination
    } catch (err) {
      console.error('❌ Registration error:', err);
      if (err.response?.status === 409) {
        setMessage('❌ User already exists');
      } else {
        setMessage('❌ Failed to register user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Register New User</h1>

        {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <input
            type="text"
            name="employee_id"
            placeholder="Employee ID"
            value={formData.employee_id}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
            <label className="text-sm text-gray-600 block mt-1">
              <input
                type="checkbox"
                className="mr-1"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
              />
              Show Password
            </label>
          </div>

          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          >
            <option value="requester">Requester</option>
            <option value="HOD">HOD</option>
            <option value="CMO">CMO</option>
            <option value="COO">COO</option>
            <option value="CFO">CFO</option>
            <option value="CEO">CEO</option>
            <option value="CPO">CPO</option>
            <option value="ProcurementSupervisor">ProcurementSupervisor</option>
            <option value="Procurement Specialist">Procurement Specialist</option>
            <option value="WarehouseManager">Warehouse Manager</option>
            <option value="warehouse_keeper">Warehouse Keeper</option>
          </select>

          {/* Department Selector */}
          <select
            name="department_id"
            value={formData.department_id}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                department_id: e.target.value,
                section_id: '', // reset section
              }))
            }
            className="w-full p-2 border rounded"
            required
          >
            <option value="">-- Select Department --</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>

          {/* Section Selector (shown only if department has sections) */}
          {(() => {
            const selectedDep = departments.find(
              (dep) => dep.id === parseInt(formData.department_id)
            );
            return selectedDep?.sections?.length ? (
              <select
                name="section_id"
                value={formData.section_id}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="">-- Select Section (optional) --</option>
                {selectedDep.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            ) : null;
          })()}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 rounded transition duration-200 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </>
  );
};

export default Register;
