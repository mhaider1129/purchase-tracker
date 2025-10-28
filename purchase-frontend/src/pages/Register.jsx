// src/pages/Register.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import LanguageSwitcher from '../components/LanguageSwitcher';

const Register = () => {
  const { t } = useTranslation();
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
      alert(t('register.alerts.loginRequired'));
      return navigate('/login');
    }

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const allowedRoles = ['SCM', 'ProcurementSupervisor'];
      if (!allowedRoles.includes(decoded.role)) {
        alert(t('register.alerts.accessDenied'));
        return navigate('/');
      }
    } catch (err) {
      alert(t('register.alerts.invalidToken'));
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
        setMessage(t('register.messages.employeeIdRequired'));
        setLoading(false);
        return;
      }

      await api.post('/auth/register', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert(t('register.alerts.success'));
      navigate('/admin/users'); // Optional: Adjust destination
    } catch (err) {
      console.error('❌ Registration error:', err);
      if (err.response?.status === 409) {
        setMessage(t('register.messages.userExists'));
      } else {
        setMessage(t('register.messages.genericError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-md mx-auto p-6">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-bold mb-4">{t('register.title')}</h1>

        {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder={t('register.fields.fullName')}
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <input
            type="email"
            name="email"
            placeholder={t('register.fields.email')}
            value={formData.email}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <input
            type="text"
            name="employee_id"
            placeholder={t('register.fields.employeeId')}
            value={formData.employee_id}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder={t('register.fields.password')}
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
              {t('register.actions.showPassword')}
            </label>
          </div>

          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          >
            <option value="requester">{t('register.roles.requester')}</option>
            <option value="HOD">{t('register.roles.hod')}</option>
            <option value="CMO">{t('register.roles.cmo')}</option>
            <option value="COO">{t('register.roles.coo')}</option>
            <option value="CFO">{t('register.roles.cfo')}</option>
            <option value="CEO">{t('register.roles.ceo')}</option>
            <option value="CPO">{t('register.roles.cpo')}</option>
            <option value="ProcurementSupervisor">{t('register.roles.procurementSupervisor')}</option>
            <option value="Procurement Specialist">{t('register.roles.procurementSpecialist')}</option>
            <option value="WarehouseManager">{t('register.roles.warehouseManager')}</option>
            <option value="warehouse_keeper">{t('register.roles.warehouseKeeper')}</option>
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
            <option value="">{t('register.fields.selectDepartment')}</option>
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
                <option value="">{t('register.fields.selectSectionOptional')}</option>
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
            {loading ? t('register.actions.registering') : t('register.actions.register')}
          </button>
        </form>
      </div>
    </>
  );
};

export default Register;