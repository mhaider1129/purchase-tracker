import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';

const Management = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [tab, setTab] = useState('users');
  const [editUserId, setEditUserId] = useState(null);
  const [editData, setEditData] = useState({
    role: '',
    department_id: '',
    section_id: '',
    can_request_medication: false,
  });
  const [newDept, setNewDept] = useState({ name: '', type: 'operational' });
  const [newSection, setNewSection] = useState({ department_id: '', name: '' });
  const [editRoutes, setEditRoutes] = useState({});
  const [newRoute, setNewRoute] = useState({
    request_type: '',
    department_type: 'medical',
    approval_level: 1,
    role: '',
    min_amount: 0,
    max_amount: 0,
  });

  // Initial fetch of all required data
  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchRoles();
  }, []);

  
    // Refresh data whenever a management tab is activated so the
  // displayed lists stay in sync with the server
  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'departments') fetchDepartments();
    if (tab === 'roles') fetchRoles();
    if (tab === 'routes') fetchRoutes();
  }, [tab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
    const res = await api.get('/api/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchDepartments = async () => {
    setLoadingDeps(true);
    try {
    const res = await api.get('/api/departments');
      setDepartments(res.data || []);
    } catch (err) {
      console.error('Failed to load departments', err);
    } finally {
      setLoadingDeps(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/roles');
      setRoles(res.data || []);
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  };

  const fetchRoutes = async () => {
    setLoadingRoutes(true);
    try {
      const res = await api.get('/api/approval-routes');
      setRoutes(res.data || []);
    } catch (err) {
      console.error('Failed to load approval routes', err);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const deactivateUser = async (id) => {
    if(!window.confirm('Deactivate this user?')) return;
    try {
      await api.patch(`/api/users/${id}/deactivate`);
      fetchUsers();
    } catch(err) {
      console.error('Failed to deactivate', err);
    }
  };

  const saveRoute = async (route) => {
    try {
      if (route.id) {
        await api.put(`/api/approval-routes/${route.id}`, route);
      } else {
        await api.post('/api/approval-routes', route);
        setNewRoute({
          request_type: '',
          department_type: 'medical',
          approval_level: 1,
          role: '',
          min_amount: 0,
          max_amount: 0,
        });
      }
      fetchRoutes();
      setEditRoutes((prev) => {
        const copy = { ...prev };
        if (route.id) delete copy[route.id];
        return copy;
      });
    } catch (err) {
      console.error('Failed to save approval route', err);
    }
  };

  const deleteRoute = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    try {
      await api.delete(`/api/approval-routes/${id}`);
      fetchRoutes();
    } catch (err) {
      console.error('Failed to delete route', err);
    }
  };


  const startEdit = (user) => {
    setEditUserId(user.id);
    setEditData({
      role: user.role || '',
      department_id: user.department_id || '',
      section_id: user.section_id || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      await api.patch(`/api/users/${id}/assign`, {
        role: editData.role,
        department_id: editData.department_id
          ? parseInt(editData.department_id, 10)
          : null,
        section_id: editData.section_id
          ? parseInt(editData.section_id, 10)
          : null,
        can_request_medication: editData.can_request_medication,
      });      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user', err);
    }
  };

  const renderUsers = () => (
    <div className="overflow-x-auto">
      {loadingUsers ? (
        <p>Loading users...</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Department</th>
              <th className="p-2">Section</th>
              <th className="p-2">Medication?</th>
              <th className="p-2">Active</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  {editUserId === u.id ? (
                    <select
                      className="border p-1"
                      value={editData.role}
                      onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                    >
                      <option value="">--Select--</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    u.role
                  )}
                </td>
                <td className="p-2">
                  {editUserId === u.id ? (
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
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    u.department_id
                  )}
                </td>
                <td className="p-2">
                  {editUserId === u.id ? (
                    editData.department_id && (
                      <select
                        className="border p-1"
                        value={editData.section_id}
                        onChange={(e) => setEditData({ ...editData, section_id: e.target.value })}
                      >
                        <option value="">--Section--</option>
                        {departments
                          .find((d) => d.id === parseInt(editData.department_id))
                          ?.sections?.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    )
                  ) : (
                    u.section_id
                  )}
                </td>
                <td className="p-2">
                  {editUserId === u.id ? (
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
                  ) : u.can_request_medication ? (
                    'Yes'
                  ) : (
                    'No'
                  )}
                </td>
                <td className="p-2">{u.is_active ? 'Yes' : 'No'}</td>
                <td className="p-2">
                  {editUserId === u.id ? (
                    <>
                      <button onClick={() => saveEdit(u.id)} className="text-green-600 mr-2">Save</button>
                      <button onClick={() => setEditUserId(null)} className="text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <>
                      {u.is_active && (
                        <button
                          onClick={() => deactivateUser(u.id)}
                          className="text-red-600 hover:underline mr-2"
                        >
                          Deactivate
                        </button>
                      )}
                      <button onClick={() => startEdit(u)} className="text-blue-600 hover:underline">
                        Assign
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const addDepartment = async () => {
    if (!window.confirm('Add this department?')) return;
    try {
      await api.post('/api/departments', newDept);
      setNewDept({ name: '', type: 'operational' });
      fetchDepartments();
    } catch (err) {
      console.error('Failed to add department', err);
    }
  };

  const addSection = async () => {
    if (!window.confirm('Add this section?')) return;
    try {
      await api.post(`/api/departments/${newSection.department_id}/sections`, { name: newSection.name });
      setNewSection({ department_id: '', name: '' });
      fetchDepartments();
    } catch (err) {
      console.error('Failed to add section', err);
    }
  };

  const renderDepartments = () => (
    <div className="overflow-x-auto">
      {loadingDeps ? (
        <p>Loading departments...</p>
      ) : (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Department</th>
                <th className="p-2">Sections</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="p-2">{d.name}</td>
                  <td className="p-2">
                    {d.sections && d.sections.length > 0 ? (
                      <ul className="list-disc ml-4">
                        {d.sections.map((s) => (
                          <li key={s.id}>{s.name}</li>
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
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="font-semibold">Add Department</h3>
              <input
                className="border p-1 mr-2"
                placeholder="Name"
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              />
              <select
                className="border p-1 mr-2"
                value={newDept.type}
                onChange={(e) => setNewDept({ ...newDept, type: e.target.value })}
              >
                <option value="medical">Medical</option>
                <option value="operational">Operational</option>
              </select>
              <button onClick={addDepartment} className="px-2 py-1 bg-blue-600 text-white">Add</button>
            </div>
            <div>
              <h3 className="font-semibold">Add Section</h3>
              <select
                className="border p-1 mr-2"
                value={newSection.department_id}
                onChange={(e) => setNewSection({ ...newSection, department_id: e.target.value })}
              >
                <option value="">--Dept--</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                className="border p-1 mr-2"
                placeholder="Section name"
                value={newSection.name}
                onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
              />
              <button onClick={addSection} className="px-2 py-1 bg-blue-600 text-white">Add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderRoutes = () => (
    <div className="overflow-x-auto">
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
            {routes.map((r) => {
              const editing = editRoutes[r.id] || {};
              const data = editing.request_type ? editing : r;
              return (
                <tr key={r.id} className="border-b">
                  <td className="p-2">
                    {editing.request_type !== undefined ? (
                      <input
                        className="border p-1"
                        value={data.request_type}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [r.id]: { ...data, request_type: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      r.request_type
                    )}
                  </td>
                  <td className="p-2">
                    {editing.department_type !== undefined ? (
                      <input
                        className="border p-1"
                        value={data.department_type}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [r.id]: { ...data, department_type: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      r.department_type
                    )}
                  </td>
                  <td className="p-2">
                    {editing.approval_level !== undefined ? (
                      <input
                        type="number"
                        className="border p-1 w-16"
                        value={data.approval_level}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [r.id]: { ...data, approval_level: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      r.approval_level
                    )}
                  </td>
                  <td className="p-2">
                    {editing.role !== undefined ? (
                      <select
                        className="border p-1"
                        value={data.role}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [r.id]: { ...data, role: e.target.value },
                          }))
                        }
                      >
                        <option value="">--Role--</option>
                        {roles.map((ro) => (
                          <option key={ro.id} value={ro.name}>
                            {ro.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      r.role
                    )}
                  </td>
                  <td className="p-2">
                    {editing.min_amount !== undefined ? (
                      <input
                        type="number"
                        className="border p-1 w-20"
                        value={data.min_amount}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [r.id]: { ...data, min_amount: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      r.min_amount
                    )}
                  </td>
                  <td className="p-2">
                    {editing.max_amount !== undefined ? (
                      <input
                        type="number"
                        className="border p-1 w-20"
                        value={data.max_amount}
                        onChange={(e) =>
                          setEditRoutes((prev) => ({
                            ...prev,
                            [r.id]: { ...data, max_amount: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      r.max_amount
                    )}
                  </td>
                  <td className="p-2">
                    {editing.request_type !== undefined ? (
                      <>
                        <button
                          onClick={() => saveRoute({ id: r.id, ...data })}
                          className="text-green-600 mr-2"
                        >
                          Save
                        </button>
                        <button
                          onClick={() =>
                            setEditRoutes((prev) => {
                              const copy = { ...prev };
                              delete copy[r.id];
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
                            setEditRoutes((prev) => ({ ...prev, [r.id]: r }))
                          }
                          className="text-blue-600 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRoute(r.id)}
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
                    setNewRoute({ ...newRoute, request_type: e.target.value })
                  }
                />
              </td>
              <td className="p-2">
                <input
                  className="border p-1"
                  value={newRoute.department_type}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, department_type: e.target.value })
                  }
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  className="border p-1 w-16"
                  value={newRoute.approval_level}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, approval_level: e.target.value })
                  }
                />
              </td>
              <td className="p-2">
                <select
                  className="border p-1"
                  value={newRoute.role}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, role: e.target.value })
                  }
                >
                  <option value="">--Role--</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <input
                  type="number"
                  className="border p-1 w-20"
                  value={newRoute.min_amount}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, min_amount: e.target.value })
                  }
                />
              </td>
              <td className="p-2">
                <input
                  type="number"
                  className="border p-1 w-20"
                  value={newRoute.max_amount}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, max_amount: e.target.value })
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

  
  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">System Management</h2>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setTab('users')}
            className={`px-3 py-1 rounded ${tab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Users
          </button>
          <button
            onClick={() => setTab('departments')}
            className={`px-3 py-1 rounded ${tab === 'departments' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Departments
          </button>
          <button
            onClick={() => setTab('routes')}
            className={`px-3 py-1 rounded ${tab === 'routes' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Approval Routes
          </button>
        </div>

        {tab === 'users' && renderUsers()}
        {tab === 'departments' && renderDepartments()}
        {tab === 'routes' && renderRoutes()}
      </div>
    </>
  );
};

export default Management;