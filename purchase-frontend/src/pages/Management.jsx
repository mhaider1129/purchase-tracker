import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { useAccessControl } from '../hooks/useAccessControl';
import { hasPermission, hasAnyPermission } from '../utils/permissions';
import useWarehouses from '../hooks/useWarehouses';

const initialUserEditState = {
  role: '',
  department_id: '',
  section_id: '',
  can_request_medication: false,
  warehouse_id: '',
};

const initialNewDepartment = { name: '', type: 'operational' };
const initialNewSection = { department_id: '', name: '' };
const initialNewRoute = {
  request_type: '',
  department_type: 'medical',
  approval_level: '1',
  role: '',
  min_amount: '',
  max_amount: '',
};

const Management = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [accountRequests, setAccountRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [warehouseForm, setWarehouseForm] = useState({ name: '' });
  const [warehouseMessage, setWarehouseMessage] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);
  const [editingWarehouseName, setEditingWarehouseName] = useState('');

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [projectMessage, setProjectMessage] = useState('');
  const [projectError, setProjectError] = useState('');

  const [usersError, setUsersError] = useState('');
  const [departmentsError, setDepartmentsError] = useState('');
  const [routesError, setRoutesError] = useState('');
  const [requestsError, setRequestsError] = useState('');

  const [tab, setTab] = useState('users');
  const [editUserId, setEditUserId] = useState(null);
  const [editData, setEditData] = useState(initialUserEditState);

  const [userFilters, setUserFilters] = useState({
    search: '',
    role: 'all',
    showInactive: false,
  });

  const [requestFilters, setRequestFilters] = useState({
    search: '',
    status: 'all',
  });

  const [newDept, setNewDept] = useState(initialNewDepartment);
  const [newSection, setNewSection] = useState(initialNewSection);
  const [editRoutes, setEditRoutes] = useState({});
  const [newRoute, setNewRoute] = useState(initialNewRoute);
  const [newProjectName, setNewProjectName] = useState('');

  const { user } = useAuth();
  const {
    warehouses,
    warehouseMap,
    loading: warehousesLoading,
    error: warehousesError,
    refresh: refreshWarehouses,
  } = useWarehouses();
  const {
    resources: uiResources,
    loading: uiAccessLoading,
    error: uiAccessLoadError,
    refresh: refreshUiAccess,
  } = useAccessControl();

  const permissionFlags = useMemo(() => {
    const currentUser = user || {};
    return {
      canManageUsers: hasPermission(currentUser, 'users.manage'),
      canViewUsers: hasAnyPermission(currentUser, ['users.view', 'users.manage']),
      canManageAccountRequests: hasPermission(currentUser, 'users.manage'),
      canManageDepartments: hasPermission(currentUser, 'departments.manage'),
      canManageRoutes: hasPermission(currentUser, 'permissions.manage'),
      canManageProjects: hasPermission(currentUser, 'projects.manage'),
      canManagePermissions: hasPermission(currentUser, 'permissions.manage'),
    };
  }, [user]);

  const {
    canManageUsers,
    canViewUsers,
    canManageAccountRequests,
    canManageDepartments,
    canManageRoutes,
    canManageProjects,
    canManagePermissions,
  } = permissionFlags;

  const availableTabs = useMemo(() => {
    const tabs = [];
    if (canViewUsers) tabs.push('users');
    if (canManageAccountRequests) tabs.push('accountRequests');
    if (canManageDepartments) tabs.push('departments');
    if (canManageDepartments) tabs.push('warehouses');
    if (canManageRoutes) tabs.push('routes');
    if (canManageProjects) tabs.push('projects');
    if (canManagePermissions) {
      tabs.push('permissions');
      tabs.push('interfaceAccess');
    }
    return tabs;
  }, [
    canViewUsers,
    canManageAccountRequests,
    canManageDepartments,
    canManageRoutes,
    canManageProjects,
    canManagePermissions,
  ]);

  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [permissionsSuccess, setPermissionsSuccess] = useState('');
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState('');
  const [selectedUserPermissions, setSelectedUserPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [editingAccessKey, setEditingAccessKey] = useState('');
  const [editingAccessPermissions, setEditingAccessPermissions] = useState([]);
  const [editingAccessRequireAll, setEditingAccessRequireAll] = useState(false);
  const [customAccessPermission, setCustomAccessPermission] = useState('');
  const [accessConfigError, setAccessConfigError] = useState('');
  const [accessConfigSuccess, setAccessConfigSuccess] = useState('');
  const [savingAccessConfig, setSavingAccessConfig] = useState(false);

  useEffect(() => {
    if (canViewUsers || canManageRoutes || canManagePermissions) {
      fetchRoles();
    }
    if (canViewUsers || canManagePermissions) {
      fetchUsers();
    }
    if (canManageDepartments || canViewUsers || canManagePermissions) {
      fetchDepartments();
    }
    if (canManageRoutes) {
      fetchRoutes();
    }
    if (canManageAccountRequests) {
      fetchAccountRequests();
    }
    if (canManageProjects) {
      fetchProjects();
    }
  }, [
    canViewUsers,
    canManageRoutes,
    canManagePermissions,
    canManageDepartments,
    canManageAccountRequests,
    canManageProjects,
  ]);

  useEffect(() => {
    if (tab === 'users' && canViewUsers) {
      fetchUsers();
      fetchDepartments();
      if (!roles.length) {
        fetchRoles();
      }
    }
    if (tab === 'departments' && canManageDepartments) {
      fetchDepartments();
    }
    if (tab === 'warehouses' && canManageDepartments) {
      refreshWarehouses();
      fetchDepartments();
    }
    if (tab === 'routes' && canManageRoutes) {
      fetchRoutes();
      if (!roles.length) {
        fetchRoles();
      }
    }
    if (tab === 'permissions' && canManagePermissions) {
      fetchUsers();
      if (!availablePermissions.length) {
        fetchPermissionsCatalog();
      }
    }
    if (tab === 'accountRequests' && canManageAccountRequests) {
      fetchAccountRequests();
    }
    if (tab === 'projects' && canManageProjects) {
      fetchProjects();
    }
  }, [
    tab,
    canViewUsers,
    canManageDepartments,
    canManageRoutes,
    canManagePermissions,
    canManageAccountRequests,
    canManageProjects,
    roles.length,
    availablePermissions.length,
  ]);

  useEffect(() => {
    if (availableTabs.length === 0) {
      return;
    }
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0]);
    }
  }, [availableTabs, tab]);

  useEffect(() => {
    if (canManagePermissions) {
      fetchPermissionsCatalog();
    } else {
      setAvailablePermissions([]);
      setSelectedPermissionUserId('');
      setSelectedUserPermissions([]);
      setPermissionsError('');
      setPermissionsSuccess('');
    }
  }, [canManagePermissions]);

  useEffect(() => {
    if (!canManagePermissions) {
      return;
    }
    if (!selectedPermissionUserId && users.length > 0) {
      setSelectedPermissionUserId(String(users[0].id));
    }
  }, [canManagePermissions, users, selectedPermissionUserId]);

  useEffect(() => {
    if (!canManagePermissions || !selectedPermissionUserId) {
      return;
    }
    fetchUserPermissions(selectedPermissionUserId);
  }, [canManagePermissions, selectedPermissionUserId]);

  const fetchUsers = async () => {
    if (!(canViewUsers || canManagePermissions)) return;
    setLoadingUsers(true);
    setUsersError('');
    try {
      const res = await api.get('/api/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
      const message = err?.response?.data?.message || 'Failed to load users. Please try again.';
      setUsersError(message);
      if (canManagePermissions && !canViewUsers) {
        setPermissionsError(message);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchDepartments = async () => {
    if (!(canManageDepartments || canViewUsers || canManagePermissions)) return;
    setLoadingDepartments(true);
    setDepartmentsError('');
    try {
      const res = await api.get('/api/departments');
      setDepartments(res.data || []);
    } catch (err) {
      console.error('Failed to load departments', err);
      setDepartmentsError('Failed to load departments.');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchRoles = async () => {
    if (!(canViewUsers || canManageRoutes || canManagePermissions)) return;
    try {
      const res = await api.get('/api/roles');
      setRoles(res.data || []);
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  };

  const fetchRoutes = async () => {
    if (!canManageRoutes) return;
    setLoadingRoutes(true);
    setRoutesError('');
    try {
      const res = await api.get('/api/approval-routes');
      setRoutes(res.data || []);
    } catch (err) {
      console.error('Failed to load approval routes', err);
      setRoutesError('Failed to load approval routes.');
    } finally {
      setLoadingRoutes(false);
    }
  };

  const fetchAccountRequests = async () => {
    if (!canManageAccountRequests) return;
    setLoadingRequests(true);
    setRequestsError('');
    try {
      const res = await api.get('/auth/register-requests');
      setAccountRequests(res.data?.requests || []);
    } catch (err) {
      console.error('Failed to load account requests', err);
      setRequestsError('Failed to load account requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchProjects = async () => {
    if (!canManageProjects) return;
    setLoadingProjects(true);
    setProjectError('');
    setProjectMessage('');
    try {
      const res = await api.get('/api/projects/management');
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to load projects', err);
      setProjectError(err?.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPermissionsCatalog = async () => {
    if (!canManagePermissions) return;
    setPermissionsLoading(true);
    setPermissionsError('');
    try {
      const res = await api.get('/api/permissions');
      setAvailablePermissions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load permissions', err);
      setPermissionsError('Failed to load permissions. Please try again.');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const fetchUserPermissions = async (userId) => {
    if (!canManagePermissions || !userId) return;
    setPermissionsLoading(true);
    setPermissionsError('');
    setPermissionsSuccess('');
    try {
      const res = await api.get(`/api/permissions/users/${userId}`);
      setSelectedUserPermissions(res.data?.permissions || []);
    } catch (err) {
      console.error('Failed to load user permissions', err);
      setPermissionsError('Failed to load user permissions.');
      setSelectedUserPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const togglePermissionForUser = (code) => {
    setPermissionsSuccess('');
    setSelectedUserPermissions((prev) => {
      if (prev.includes(code)) {
        return prev.filter((permission) => permission !== code);
      }
      return [...prev, code];
    });
  };

  const saveUserPermissions = async () => {
    if (!canManagePermissions || !selectedPermissionUserId) {
      return;
    }
    setSavingPermissions(true);
    setPermissionsError('');
    setPermissionsSuccess('');
    try {
      await api.put(`/api/permissions/users/${selectedPermissionUserId}`, {
        permissions: selectedUserPermissions,
      });
      setPermissionsSuccess('Permissions updated successfully.');
    } catch (err) {
      console.error('Failed to update user permissions', err);
      setPermissionsError(err?.response?.data?.message || 'Failed to update user permissions.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const startEditingAccessResource = (resource) => {
    if (!resource) {
      return;
    }

    setAccessConfigError('');
    setAccessConfigSuccess('');
    setEditingAccessKey(resource.key);
    setEditingAccessPermissions(
      Array.isArray(resource.permissions)
        ? resource.permissions
            .map((code) => (typeof code === 'string' ? code.toLowerCase() : ''))
            .filter(Boolean)
        : []
    );
    setEditingAccessRequireAll(Boolean(resource.requireAll));
    setCustomAccessPermission('');
  };

  const cancelEditingAccessResource = () => {
    setEditingAccessKey('');
    setEditingAccessPermissions([]);
    setEditingAccessRequireAll(false);
    setCustomAccessPermission('');
  };

  const toggleAccessPermissionForResource = (code) => {
    if (typeof code !== 'string') {
      return;
    }

    const normalized = code.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    setEditingAccessPermissions((prev) => {
      const exists = prev.some((entry) => entry.toLowerCase() === normalized);
      if (exists) {
        return prev.filter((entry) => entry.toLowerCase() !== normalized);
      }
      return [...prev, normalized];
    });
  };

  const addCustomPermissionToResource = () => {
    const normalized = customAccessPermission.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    setEditingAccessPermissions((prev) => {
      if (prev.some((entry) => entry.toLowerCase() === normalized)) {
        return prev;
      }
      return [...prev, normalized];
    });

    setCustomAccessPermission('');
  };

  const saveInterfaceAccess = async () => {
    if (!canManagePermissions || !editingAccessKey) {
      return;
    }

    setSavingAccessConfig(true);
    setAccessConfigError('');
    setAccessConfigSuccess('');

    try {
      await api.put(`/api/ui-access/${editingAccessKey}`, {
        permissions: editingAccessPermissions,
        requireAll: editingAccessRequireAll,
      });
      setAccessConfigSuccess('Interface access updated successfully.');
      cancelEditingAccessResource();
      await refreshUiAccess();
    } catch (err) {
      console.error('Failed to update interface access', err);
      setAccessConfigError(err?.response?.data?.message || 'Failed to update interface access.');
    } finally {
      setSavingAccessConfig(false);
    }
  };

  const deactivateUser = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await api.patch(`/api/users/${id}/deactivate`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to deactivate user', err);
      alert('Unable to deactivate this user.');
    }
  };

  const startEdit = (user) => {
    setEditUserId(user.id);
    setEditData({
      role: user.role || '',
      department_id: user.department_id ? String(user.department_id) : '',
      section_id: user.section_id ? String(user.section_id) : '',
      can_request_medication: Boolean(user.can_request_medication),
      warehouse_id: user.warehouse_id ? String(user.warehouse_id) : '',
    });
  };

  const cancelEdit = () => {
    setEditUserId(null);
    setEditData(initialUserEditState);
  };

  const saveEdit = async (id) => {
    try {
      await api.patch(`/api/users/${id}/assign`, {
        role: editData.role,
        department_id: editData.department_id ? Number(editData.department_id) : null,
        section_id: editData.section_id ? Number(editData.section_id) : null,
        warehouse_id: editData.warehouse_id ? Number(editData.warehouse_id) : null,
        can_request_medication: editData.can_request_medication,
      });
      setEditUserId(null);
      setEditData(initialUserEditState);
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user', err);
      alert('Unable to update user details.');
    }
  };

  const approveAccountRequest = async (id) => {
    if (!window.confirm('Approve this account request?')) return;
    try {
      await api.post(`/auth/register-requests/${id}/approve`);
      fetchAccountRequests();
      fetchUsers();
    } catch (err) {
      console.error('Failed to approve account request', err);
      alert(err.response?.data?.message || 'Failed to approve request.');
    }
  };

  const rejectAccountRequest = async (id) => {
    if (!window.confirm('Reject this account request?')) return;
    const reason = window.prompt('Reason for rejection (optional):', '') || '';
    try {
      await api.post(`/auth/register-requests/${id}/reject`, {
        reason: reason.trim() || undefined,
      });
      fetchAccountRequests();
    } catch (err) {
      console.error('Failed to reject account request', err);
      alert(err.response?.data?.message || 'Failed to reject request.');
    }
  };

  const addProject = async (event) => {
    event.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setProjectError('Project name is required');
      return;
    }

    setProjectError('');
    setProjectMessage('');

    try {
      await api.post('/api/projects', { name: trimmed });
      setNewProjectName('');
      setProjectMessage(`Project "${trimmed}" added successfully`);
      fetchProjects();
    } catch (err) {
      console.error('Failed to add project', err);
      setProjectError(err?.response?.data?.message || 'Failed to add project');
    }
  };

  const deactivateProject = async (project) => {
    if (!window.confirm(`Deactivate the project "${project.name}"?`)) return;

    setProjectError('');
    setProjectMessage('');

    try {
      const res = await api.patch(`/api/projects/${project.id}/deactivate`);
      const updatedProject = res.data?.project || { ...project, is_active: false };
      setProjects((prev) =>
        prev.map((item) => (item.id === project.id ? updatedProject : item))
      );
      setProjectMessage(res.data?.message || `Project "${project.name}" deactivated`);
    } catch (err) {
      console.error('Failed to deactivate project', err);
      setProjectError(err?.response?.data?.message || 'Failed to deactivate project');
    }
  };

  const addDepartment = async () => {
    if (!newDept.name.trim()) {
      alert('Department name is required.');
      return;
    }
    if (!window.confirm('Add this department?')) return;
    try {
      await api.post('/api/departments', newDept);
      setNewDept(initialNewDepartment);
      fetchDepartments();
    } catch (err) {
      console.error('Failed to add department', err);
      alert('Unable to add department.');
    }
  };

  const addSection = async () => {
    if (!newSection.department_id) {
      alert('Please choose a department.');
      return;
    }
    if (!newSection.name.trim()) {
      alert('Section name is required.');
      return;
    }
    if (!window.confirm('Add this section?')) return;
    try {
      await api.post(`/api/departments/${newSection.department_id}/sections`, {
        name: newSection.name,
      });
      setNewSection(initialNewSection);
      fetchDepartments();
    } catch (err) {
      console.error('Failed to add section', err);
      alert('Unable to add section.');
    }
  };

  const startEditingWarehouse = (warehouse) => {
    setEditingWarehouseId(warehouse.id);
    setEditingWarehouseName(warehouse.name || '');
    setWarehouseMessage('');
    setWarehouseError('');
  };

  const cancelWarehouseEdit = () => {
    setEditingWarehouseId(null);
    setEditingWarehouseName('');
  };

  const addWarehouse = async () => {
    const trimmed = warehouseForm.name.trim();
    if (!trimmed) {
      setWarehouseError('Warehouse name is required.');
      return;
    }
    if (!window.confirm('Add this warehouse?')) return;

    setSavingWarehouse(true);
    setWarehouseError('');
    setWarehouseMessage('');

    try {
      await api.post('/api/departments', { name: trimmed, type: 'warehouse' });
      setWarehouseForm({ name: '' });
      setWarehouseMessage('Warehouse added successfully.');
      await Promise.all([refreshWarehouses(), fetchDepartments()]);
    } catch (err) {
      console.error('Failed to add warehouse', err);
      setWarehouseError(err?.response?.data?.message || 'Unable to add warehouse.');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const saveWarehouseEdit = async () => {
    if (!editingWarehouseId) return;
    const trimmed = editingWarehouseName.trim();
    if (!trimmed) {
      setWarehouseError('Warehouse name cannot be empty.');
      return;
    }

    setSavingWarehouse(true);
    setWarehouseError('');
    setWarehouseMessage('');

    try {
      await api.put(`/api/departments/${editingWarehouseId}`, {
        name: trimmed,
        type: 'warehouse',
      });
      setWarehouseMessage('Warehouse updated successfully.');
      cancelWarehouseEdit();
      await Promise.all([refreshWarehouses(), fetchDepartments()]);
    } catch (err) {
      console.error('Failed to update warehouse', err);
      setWarehouseError(err?.response?.data?.message || 'Unable to update warehouse.');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const normalizeRoutePayload = (route) => ({
    ...route,
    approval_level: route.approval_level === '' ? null : Number(route.approval_level),
    min_amount:
      route.min_amount === '' || route.min_amount === null
        ? null
        : Number(route.min_amount),
    max_amount:
      route.max_amount === '' || route.max_amount === null
        ? null
        : Number(route.max_amount),
  });

  const saveRoute = async (route) => {
    const payload = normalizeRoutePayload(route);
    try {
      if (route.id) {
        await api.put(`/api/approval-routes/${route.id}`, payload);
      } else {
        await api.post('/api/approval-routes', payload);
        setNewRoute(initialNewRoute);
      }
      setEditRoutes((prev) => {
        if (!route.id) return prev;
        const copy = { ...prev };
        delete copy[route.id];
        return copy;
      });
      fetchRoutes();
    } catch (err) {
      console.error('Failed to save approval route', err);
      alert('Unable to save approval route.');
    }
  };

  const deleteRoute = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    try {
      await api.delete(`/api/approval-routes/${id}`);
      fetchRoutes();
    } catch (err) {
      console.error('Failed to delete route', err);
      alert('Unable to delete approval route.');
    }
  };

  const departmentMap = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => {
      map.set(dept.id, dept);
      dept.sections?.forEach((section) => {
        map.set(`section-${section.id}`, section);
      });
    });
    return map;
  }, [departments]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => {
      dept.sections?.forEach((section) => {
        map.set(section.id, section.name);
      });
    });
    return map;
  }, [departments]);

  const filteredUsers = useMemo(() => {
    const search = userFilters.search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !search ||
        user.name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search);
      const matchesRole =
        userFilters.role === 'all' ||
        (user.role && user.role.toLowerCase() === userFilters.role.toLowerCase());
      const matchesActive = userFilters.showInactive || user.is_active;
      return matchesSearch && matchesRole && matchesActive;
    });
  }, [users, userFilters]);

  const filteredRequests = useMemo(() => {
    const search = requestFilters.search.trim().toLowerCase();
    return accountRequests
      .filter((req) => {
        const matchesSearch =
          !search ||
          req.name?.toLowerCase().includes(search) ||
          req.email?.toLowerCase().includes(search);
        const matchesStatus =
          requestFilters.status === 'all' || req.status === requestFilters.status;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [accountRequests, requestFilters]);

  const activeUserCount = useMemo(
    () => users.filter((user) => user.is_active).length,
    [users]
  );
  const pendingRequestsCount = useMemo(
    () => accountRequests.filter((req) => req.status === 'pending').length,
    [accountRequests]
  );
  const activeProjectCount = useMemo(
    () => projects.filter((project) => project.is_active !== false).length,
    [projects]
  );

  const renderUsers = () => {
    if (!canViewUsers) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to view the user directory.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Search
            </label>
            <input
              type="search"
              className="mt-1 w-full rounded border border-gray-300 p-2"
              placeholder="Search by name or email"
              value={userFilters.search}
              onChange={(e) =>
                setUserFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>
          <div className="lg:w-48">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Role
            </label>
            <select
              className="mt-1 w-full rounded border border-gray-300 p-2"
              value={userFilters.role}
              onChange={(e) =>
                setUserFilters((prev) => ({ ...prev, role: e.target.value }))
              }
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={userFilters.showInactive}
              onChange={(e) =>
                setUserFilters((prev) => ({
                  ...prev,
                  showInactive: e.target.checked,
                }))
              }
            />
            Show inactive users
          </label>
        </div>
        {usersError && <p className="text-sm text-red-600">{usersError}</p>}
      </div>
      {loadingUsers ? (
        <p>Loading users...</p>
      ) : filteredUsers.length === 0 ? (
        <p className="text-sm text-gray-600">No users match the current filters.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Employee ID</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Department</th>
              <th className="p-2">Section</th>
              <th className="p-2">Warehouse</th>
              <th className="p-2">Medication?</th>
              <th className="p-2">Active</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const department = user.department_id
                ? departmentMap.get(user.department_id)
                : null;
              const section = user.section_id
                ? sectionOptions.get(user.section_id)
                : null;
              const warehouse = user.warehouse_id
                ? warehouseMap.get(user.warehouse_id)
                : null;
              return (
                <tr key={user.id} className="border-b">
                  <td className="p-2">{user.name}</td>
                  <td className="p-2">{user.employee_id || '—'}</td>
                  <td className="p-2">{user.email}</td>
                  <td className="p-2">
                    {editUserId === user.id ? (
                      <select
                        className="border p-1"
                        value={editData.role}
                        onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                      >
                        <option value="">--Select--</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      user.role || '—'
                    )}
                  </td>
                  <td className="p-2">
                    {editUserId === user.id ? (
                      <select
                        className="border p-1"
                        value={editData.department_id}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            department_id: e.target.value,
                            section_id: '',
                          })
                        }
                      >
                        <option value="">--Dept--</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    ) : department ? (
                      department.name
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2">
                    {editUserId === user.id ? (
                      editData.department_id && (
                        <select
                          className="border p-1"
                          value={editData.section_id}
                          onChange={(e) =>
                            setEditData({ ...editData, section_id: e.target.value })
                          }
                        >
                          <option value="">--Section--</option>
                          {departments
                            .find((dept) => dept.id === Number(editData.department_id))
                            ?.sections?.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.name}
                              </option>
                            ))}
                        </select>
                      )
                    ) : section ? (
                      section
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2">
                    {editUserId === user.id ? (
                      <select
                        className="border p-1"
                        value={editData.warehouse_id}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            warehouse_id: e.target.value,
                          })
                        }
                      >
                        <option value="">--Warehouse--</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}
                          </option>
                        ))}
                      </select>
                    ) : warehouse ? (
                      warehouse.name
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2">
                    {editUserId === user.id ? (
                      <input
                        type="checkbox"
                        checked={editData.can_request_medication}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            can_request_medication: e.target.checked,
                          })
                        }
                      />
                    ) : user.can_request_medication ? (
                      'Yes'
                    ) : (
                      'No'
                    )}
                  </td>
                  <td className="p-2">{user.is_active ? 'Yes' : 'No'}</td>
                  <td className="p-2">
                    {editUserId === user.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(user.id)}
                          className="text-green-600 mr-2"
                        >
                          Save
                        </button>
                        <button onClick={cancelEdit} className="text-gray-600">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {user.is_active && (
                          <button
                            onClick={() => deactivateUser(user.id)}
                            className="text-red-600 hover:underline mr-2"
                          >
                            Deactivate
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(user)}
                          className="text-blue-600 hover:underline"
                        >
                          Assign
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
    );
  };

  const renderAccountRequests = () => {
    if (!canManageAccountRequests) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage account requests.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Search
          </label>
          <input
            type="search"
            className="mt-1 w-full rounded border border-gray-300 p-2"
            placeholder="Search by name or email"
            value={requestFilters.search}
            onChange={(e) =>
              setRequestFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />
        </div>
        <div className="md:w-48">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
          </label>
          <select
            className="mt-1 w-full rounded border border-gray-300 p-2"
            value={requestFilters.status}
            onChange={(e) =>
              setRequestFilters((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      {requestsError && <p className="text-sm text-red-600 mb-2">{requestsError}</p>}
      {loadingRequests ? (
        <p>Loading account requests...</p>
      ) : filteredRequests.length === 0 ? (
        <p>No account requests found.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Department</th>
              <th className="p-2">Section</th>
              <th className="p-2">Status</th>
              <th className="p-2">Submitted</th>
              <th className="p-2">Reviewer</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req) => {
              const createdAt = req.created_at ? new Date(req.created_at) : null;
              const reviewedAt = req.reviewed_at ? new Date(req.reviewed_at) : null;
              return (
                <tr key={req.id} className="border-b">
                  <td className="p-2">{req.name}</td>
                  <td className="p-2">{req.email}</td>
                  <td className="p-2">{req.department_name || req.department_id || '—'}</td>
                  <td className="p-2">{req.section_name || '—'}</td>
                  <td className="p-2 capitalize">{req.status}</td>
                  <td className="p-2">
                    {createdAt ? createdAt.toLocaleString() : '—'}
                    {req.status !== 'pending' && reviewedAt ? (
                      <div className="text-xs text-gray-500">
                        Reviewed: {reviewedAt.toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2">{req.reviewer_name || '—'}</td>
                  <td className="p-2">
                    {req.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveAccountRequest(req.id)}
                          className="bg-green-600 text-white px-2 py-1 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectAccountRequest(req.id)}
                          className="bg-red-600 text-white px-2 py-1 rounded"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">
                        {req.rejection_reason
                          ? `Reason: ${req.rejection_reason}`
                          : 'Processed'}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
    );
  };

  const renderDepartments = () => {
    if (!canManageDepartments) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage departments.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        {departmentsError && (
          <p className="mb-2 text-sm text-red-600">{departmentsError}</p>
        )}
      {loadingDepartments ? (
        <p>Loading departments...</p>
      ) : (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Department</th>
                <th className="p-2">Type</th>
                <th className="p-2">Sections</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} className="border-b">
                  <td className="p-2 font-medium">{dept.name}</td>
                  <td className="p-2">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs uppercase tracking-wide text-blue-700">
                      {dept.type}
                    </span>
                  </td>
                  <td className="p-2">
                    {dept.sections?.length ? (
                      <ul className="ml-4 list-disc">
                        {dept.sections.map((section) => (
                          <li key={section.id}>{section.name}</li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase text-gray-600">
                Add Department
              </h3>
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Department name"
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              />
              <select
                className="w-full rounded border px-3 py-2"
                value={newDept.type}
                onChange={(e) => setNewDept({ ...newDept, type: e.target.value })}
              >
                <option value="medical">Medical</option>
                <option value="operational">Operational</option>
              </select>
              <button
                onClick={addDepartment}
                className="w-full rounded bg-blue-600 px-3 py-2 text-white"
              >
                Add department
              </button>
            </div>
            <div className="space-y-2 rounded border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase text-gray-600">
                Add Section
              </h3>
              <select
                className="w-full rounded border px-3 py-2"
                value={newSection.department_id}
                onChange={(e) =>
                  setNewSection({ ...newSection, department_id: e.target.value })
                }
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Section name"
                value={newSection.name}
                onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
              />
              <button
                onClick={addSection}
                className="w-full rounded bg-blue-600 px-3 py-2 text-white"
              >
                Add section
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    );
  };

  const renderWarehouses = () => {
    if (!canManageDepartments) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage warehouses.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {warehouseError && (
          <p className="text-sm text-red-600">{warehouseError}</p>
        )}
        {warehouseMessage && (
          <p className="text-sm text-green-700">{warehouseMessage}</p>
        )}
        {warehousesError && (
          <p className="text-sm text-red-600">{warehousesError}</p>
        )}
        <div className="overflow-x-auto">
          {warehousesLoading ? (
            <p>Loading warehouses...</p>
          ) : warehouses.length === 0 ? (
            <p>No warehouses found.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="border-b">
                    <td className="p-2 font-medium">
                      {editingWarehouseId === warehouse.id ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={editingWarehouseName}
                          onChange={(e) => setEditingWarehouseName(e.target.value)}
                          disabled={savingWarehouse}
                        />
                      ) : (
                        warehouse.name
                      )}
                    </td>
                    <td className="p-2">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs uppercase tracking-wide text-amber-700">
                        {warehouse.type || 'warehouse'}
                      </span>
                    </td>
                    <td className="p-2">
                      {editingWarehouseId === warehouse.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={saveWarehouseEdit}
                            disabled={savingWarehouse}
                            className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {savingWarehouse ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelWarehouseEdit}
                            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingWarehouse(warehouse)}
                          className="rounded border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-2 rounded border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-gray-600">Add Warehouse</h3>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Warehouse name"
            value={warehouseForm.name}
            onChange={(e) => setWarehouseForm({ name: e.target.value })}
            disabled={savingWarehouse}
          />
          <button
            onClick={addWarehouse}
            disabled={savingWarehouse}
            className="w-full rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {savingWarehouse ? 'Saving…' : 'Add warehouse'}
          </button>
        </div>
      </div>
    );
  };

  const renderRoutes = () => {
    if (!canManageRoutes) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage approval routes.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        {routesError && <p className="mb-2 text-sm text-red-600">{routesError}</p>}
        {loadingRoutes ? (
          <p>Loading routes...</p>
        ) : (
          <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-2">Type</th>
              <th className="p-2">Dept Type</th>
              <th className="p-2">Level</th>
              <th className="p-2">Role</th>
              <th className="p-2">Min</th>
              <th className="p-2">Max</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => {
              const editing = editRoutes[route.id];
              const data = editing || route;
              return (
                <tr key={route.id} className="border-b">
                  <td className="p-2">
                    {editing ? (
                      <input
                        className="border p-1"
                        value={data.request_type}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [route.id]: { ...data, request_type: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      route.request_type
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <select
                        className="border p-1"
                        value={data.department_type}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [route.id]: { ...data, department_type: e.target.value },
                          }))
                        }
                      >
                        <option value="medical">Medical</option>
                        <option value="operational">Operational</option>
                      </select>
                    ) : (
                      route.department_type
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input
                        type="number"
                        className="border p-1 w-20"
                        value={data.approval_level ?? ''}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [route.id]: { ...data, approval_level: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      route.approval_level
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <select
                        className="border p-1"
                        value={data.role}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [route.id]: { ...data, role: e.target.value },
                          }))
                        }
                      >
                        <option value="">--Role--</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      route.role
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input
                        type="number"
                        className="border p-1 w-24"
                        value={data.min_amount ?? ''}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [route.id]: { ...data, min_amount: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      route.min_amount ?? '—'
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input
                        type="number"
                        className="border p-1 w-24"
                        value={data.max_amount ?? ''}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [route.id]: { ...data, max_amount: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      route.max_amount ?? '—'
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <>
                        <button
                          onClick={() => saveRoute({ id: route.id, ...data })}
                          className="text-green-600 mr-2"
                        >
                          Save
                        </button>
                        <button
                          onClick={() =>
                            setEditRoutes((prev) => {
                              const copy = { ...prev };
                              delete copy[route.id];
                              return copy;
                            })
                          }
                          className="text-gray-600"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            setEditRoutes((prev) => ({
                              ...prev,
                              [route.id]: {
                                request_type: route.request_type || '',
                                department_type: route.department_type || 'medical',
                                approval_level:
                                  route.approval_level === null
                                    ? ''
                                    : String(route.approval_level),
                                role: route.role || '',
                                min_amount:
                                  route.min_amount === null
                                    ? ''
                                    : String(route.min_amount),
                                max_amount:
                                  route.max_amount === null
                                    ? ''
                                    : String(route.max_amount),
                                id: route.id,
                              },
                            }))
                          }
                          className="text-blue-600 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRoute(route.id)}
                          className="text-red-600"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="p-2">
                <input
                  className="border p-1"
                  value={newRoute.request_type}
                  onChange={(e) =>
                    setNewRoute((prev) => ({ ...prev, request_type: e.target.value }))
                  }
                />
              </td>
              <td className="p-2">
                <select
                  className="border p-1"
                  value={newRoute.department_type}
                  onChange={(e) =>
                    setNewRoute((prev) => ({ ...prev, department_type: e.target.value }))
                  }
                >
                  <option value="medical">Medical</option>
                  <option value="operational">Operational</option>
                </select>
              </td>
              <td className="p-2">
                <input
                  type="number"
                  className="border p-1 w-20"
                  value={newRoute.approval_level}
                  onChange={(e) =>
                    setNewRoute((prev) => ({ ...prev, approval_level: e.target.value }))
                  }
                />
              </td>
              <td className="p-2">
                <select
                  className="border p-1"
                  value={newRoute.role}
                  onChange={(e) => setNewRoute((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="">--Role--</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <input
                  type="number"
                  className="border p-1 w-24"
                  value={newRoute.min_amount}
                  onChange={(e) =>
                    setNewRoute((prev) => ({ ...prev, min_amount: e.target.value }))
                  }
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  className="border p-1 w-24"
                  value={newRoute.max_amount}
                  onChange={(e) =>
                    setNewRoute((prev) => ({ ...prev, max_amount: e.target.value }))
                  }
                />
              </td>
              <td className="p-2">
                <button
                  onClick={() => saveRoute(newRoute)}
                  className="bg-green-600 text-white px-2 py-1 rounded"
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        )}
    </div>
    );
  };

  const renderProjects = () => {
    if (!canManageProjects) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage projects.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-gray-600 mb-3">
            Add Project
          </h3>
        <form onSubmit={addProject} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Project name
            </span>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Enter new project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white"
            disabled={loadingProjects}
          >
            Add project
          </button>
        </form>
        {projectMessage && (
          <p className="mt-2 text-sm text-emerald-600">{projectMessage}</p>
        )}
        {projectError && <p className="mt-2 text-sm text-red-600">{projectError}</p>}
      </div>
        <div className="overflow-x-auto rounded border bg-white shadow-sm">
          {loadingProjects ? (
            <p className="p-4">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="p-4 text-sm text-gray-600">No projects available.</p>
          ) : (
            <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Name</th>
                <th className="p-2">Active</th>
                <th className="p-2">Created</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const createdAt = project.created_at ? new Date(project.created_at) : null;
                return (
                  <tr key={project.id} className="border-b">
                    <td className="p-2 font-medium text-gray-900">{project.name}</td>
                    <td className="p-2">{project.is_active !== false ? 'Yes' : 'No'}</td>
                    <td className="p-2">
                      {createdAt ? createdAt.toLocaleDateString() : '—'}
                    </td>
                    <td className="p-2">
                      {project.is_active !== false ? (
                        <button
                          onClick={() => deactivateProject(project)}
                          className="text-red-600 hover:underline"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Inactive</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          )}
      </div>
    </div>
    );
  };

  const renderPermissions = () => {
    if (!canManagePermissions) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage user permissions.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="md:w-64">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              User
            </label>
            <select
              className="mt-1 w-full rounded border border-gray-300 p-2"
              value={selectedPermissionUserId}
              onChange={(e) => setSelectedPermissionUserId(e.target.value)}
            >
              <option value="">Select user</option>
              {users.map((permissionUser) => (
                <option key={permissionUser.id} value={permissionUser.id}>
                  {permissionUser.name}
                  {permissionUser.email ? ` (${permissionUser.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 text-sm text-gray-600">
            {permissionsSuccess && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
                {permissionsSuccess}
              </div>
            )}
            {permissionsError && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
                {permissionsError}
              </div>
            )}
          </div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
          {permissionsLoading ? (
            <p>Loading permissions...</p>
          ) : !selectedPermissionUserId ? (
            <p className="text-sm text-gray-600">
              Select a user to view and update their permissions.
            </p>
          ) : availablePermissions.length === 0 ? (
            <p className="text-sm text-gray-600">No permissions available.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {availablePermissions.map((permission) => {
                const checked = selectedUserPermissions.includes(permission.code);
                return (
                  <label
                    key={permission.code}
                    className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 bg-gray-50 p-3 hover:border-blue-300"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={checked}
                      onChange={() => togglePermissionForUser(permission.code)}
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-800">
                        {permission.name}
                      </div>
                      <p className="text-xs text-gray-600">{permission.description}</p>
                      <p className="text-xs text-gray-400">Code: {permission.code}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={saveUserPermissions}
            disabled={savingPermissions || !selectedPermissionUserId}
            className={`rounded px-4 py-2 text-white ${
              savingPermissions || !selectedPermissionUserId
                ? 'bg-gray-400'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {savingPermissions ? 'Saving...' : 'Save permissions'}
          </button>
        </div>
      </div>
    );
  };

  const renderInterfaceAccess = () => {
    if (!canManagePermissions) {
      return (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You do not have permission to manage interface access.
        </div>
      );
    }

    const sortedResources = [...uiResources].sort((a, b) => {
      const labelA = a.label?.toLowerCase?.() ?? '';
      const labelB = b.label?.toLowerCase?.() ?? '';
      return labelA.localeCompare(labelB);
    });

    const interfaceError = accessConfigError || uiAccessLoadError;

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Configure which permission codes unlock each UI feature. Leave the list empty to make a
          feature available to all authenticated users.
        </p>
        {interfaceError && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {interfaceError}
          </div>
        )}
        {accessConfigSuccess && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {accessConfigSuccess}
          </div>
        )}
        <div className="overflow-x-auto rounded border border-gray-200 bg-white p-4 shadow-sm">
          {uiAccessLoading ? (
            <p>Loading interface access configuration...</p>
          ) : sortedResources.length === 0 ? (
            <p className="text-sm text-gray-600">No interface resources have been registered yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="p-2">Feature</th>
                  <th className="p-2">Description</th>
                  <th className="p-2">Permissions</th>
                  <th className="p-2">Requirement</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedResources.map((resource) => {
                  const isEditing = editingAccessKey === resource.key;
                  const activePermissions = isEditing
                    ? editingAccessPermissions
                    : resource.permissions;
                  const showSelectedList = activePermissions && activePermissions.length > 0;

                  return (
                    <tr key={resource.key} className="border-b align-top">
                      <td className="p-2 font-semibold text-gray-800">{resource.label}</td>
                      <td className="p-2 text-gray-600">{resource.description || '—'}</td>
                      <td className="p-2">
                        {isEditing ? (
                          <div className="space-y-3">
                            {permissionsLoading ? (
                              <p className="text-sm text-gray-600">Loading permission catalog...</p>
                            ) : availablePermissions.length === 0 ? (
                              <p className="text-sm text-gray-600">
                                No permission catalog found. Add custom codes below.
                              </p>
                            ) : (
                              <div className="grid gap-2 md:grid-cols-2">
                                {availablePermissions.map((permission) => {
                                  const code = permission.code?.toLowerCase?.() ?? '';
                                  const checked = editingAccessPermissions.some(
                                    (entry) => entry.toLowerCase() === code
                                  );
                                  return (
                                    <label
                                      key={permission.code}
                                      className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 bg-gray-50 p-3 hover:border-blue-300"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4"
                                        checked={checked}
                                        onChange={() => toggleAccessPermissionForResource(permission.code)}
                                      />
                                      <div>
                                        <div className="text-sm font-semibold text-gray-800">
                                          {permission.name}
                                        </div>
                                        <p className="text-xs text-gray-600">{permission.description}</p>
                                        <p className="text-xs text-gray-400">Code: {permission.code}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                type="text"
                                value={customAccessPermission}
                                onChange={(e) => setCustomAccessPermission(e.target.value)}
                                placeholder="Add permission code"
                                className="w-full rounded border border-gray-300 p-2 text-sm sm:w-auto"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={addCustomPermissionToResource}
                                  disabled={!customAccessPermission.trim()}
                                  className={`rounded px-3 py-1 text-sm font-semibold text-white ${
                                    customAccessPermission.trim()
                                      ? 'bg-blue-600 hover:bg-blue-700'
                                      : 'bg-gray-400'
                                  }`}
                                >
                                  Add code
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingAccessPermissions([])}
                                  className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                  Clear all
                                </button>
                              </div>
                            </div>
                            {editingAccessPermissions.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {editingAccessPermissions.map((code) => (
                                  <span
                                    key={code}
                                    className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"
                                  >
                                    {code}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">No permission required.</p>
                            )}
                          </div>
                        ) : showSelectedList ? (
                          <div className="flex flex-wrap gap-2">
                            {activePermissions.map((code) => (
                              <span
                                key={code}
                                className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No permission required</span>
                        )}
                      </td>
                      <td className="p-2">
                        {isEditing ? (
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editingAccessRequireAll}
                              onChange={(e) => setEditingAccessRequireAll(e.target.checked)}
                              className="h-4 w-4"
                            />
                            Require all selected permissions
                          </label>
                        ) : showSelectedList ? (
                          <span className="text-xs text-gray-600">
                            {resource.requireAll
                              ? 'All selected permissions'
                              : 'Any selected permission'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">Not required</span>
                        )}
                      </td>
                      <td className="p-2">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveInterfaceAccess}
                              disabled={savingAccessConfig}
                              className={`rounded px-3 py-1 text-sm font-semibold text-white ${
                                savingAccessConfig
                                  ? 'bg-gray-400'
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              {savingAccessConfig ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingAccessResource}
                              className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingAccessResource(resource)}
                            className="rounded border border-blue-200 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };


  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">System Management</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Active users
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-900">{activeUserCount}</p>
            <p className="text-xs text-blue-700">of {users.length} total</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Pending account requests
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">
              {pendingRequestsCount}
            </p>
            <p className="text-xs text-emerald-700">Awaiting review</p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Departments
            </p>
            <p className="mt-2 text-2xl font-bold text-indigo-900">{departments.length}</p>
            <p className="text-xs text-indigo-700">Across all types</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Warehouses
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{warehouses.length}</p>
            <p className="text-xs text-amber-700">Available locations</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Active projects
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{activeProjectCount}</p>
            <p className="text-xs text-amber-700">Management overview</p>
          </div>
        </div>
        <div className="flex gap-4 mb-4 flex-wrap">
          {canViewUsers && (
            <button
              onClick={() => setTab('users')}
              className={`px-3 py-1 rounded ${
                tab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              Users
            </button>
          )}
          {canManageAccountRequests && (
            <button
              onClick={() => setTab('accountRequests')}
              className={`px-3 py-1 rounded ${
                tab === 'accountRequests' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              Account Requests
            </button>
          )}
          {canManageDepartments && (
            <button
              onClick={() => setTab('departments')}
              className={`px-3 py-1 rounded ${
                tab === 'departments' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              Departments
            </button>
          )}
          {canManageDepartments && (
            <button
              onClick={() => setTab('warehouses')}
              className={`px-3 py-1 rounded ${
                tab === 'warehouses' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              Warehouses
            </button>
          )}
          {canManageRoutes && (
            <button
              onClick={() => setTab('routes')}
              className={`px-3 py-1 rounded ${
                tab === 'routes' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              Approval Routes
            </button>
          )}
          {canManageProjects && (
            <button
              onClick={() => setTab('projects')}
              className={`px-3 py-1 rounded ${
                tab === 'projects' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              Projects
            </button>
          )}
          {canManagePermissions && (
            <>
              <button
                onClick={() => setTab('permissions')}
                className={`px-3 py-1 rounded ${
                  tab === 'permissions' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Permissions
              </button>
              <button
                onClick={() => setTab('interfaceAccess')}
                className={`px-3 py-1 rounded ${
                  tab === 'interfaceAccess' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Interface Access
              </button>
            </>
          )}
        </div>

        {tab === 'users' && renderUsers()}
        {tab === 'accountRequests' && renderAccountRequests()}
        {tab === 'departments' && renderDepartments()}
        {tab === 'warehouses' && renderWarehouses()}
        {tab === 'routes' && renderRoutes()}
        {tab === 'projects' && renderProjects()}
        {tab === 'permissions' && renderPermissions()}
        {tab === 'interfaceAccess' && renderInterfaceAccess()}
      </div>
    </>
  );
};

export default Management;