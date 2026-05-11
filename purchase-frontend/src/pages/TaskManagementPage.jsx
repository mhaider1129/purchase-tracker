import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';

const INITIAL_ASSIGN_FORM = { title: '', description: '', assigned_to: '' };
const STATUS_OPTIONS = ['pending', 'in_progress', 'blocked', 'completed'];

export default function TaskManagementPage() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const canAssign = role === 'scm' || role === 'coo';

  const [myTasks, setMyTasks] = useState([]);
  const [assignedByMe, setAssignedByMe] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignForm, setAssignForm] = useState(INITIAL_ASSIGN_FORM);
  const [managerFilter, setManagerFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, usersRes, assignedRes] = await Promise.all([
        api.get('/api/tasks/my'),
        canAssign ? api.get('/api/users') : Promise.resolve({ data: { users: [] } }),
        canAssign ? api.get(`/api/tasks/assigned-by-me${managerFilter ? `?status=${managerFilter}` : ''}`) : Promise.resolve({ data: { tasks: [] } }),
      ]);

      setMyTasks(myRes.data?.tasks || []);
      const usersPayload = usersRes?.data;
      const usersList = Array.isArray(usersPayload) ? usersPayload : (usersPayload?.users || []);
      setEmployees(usersList);
      setAssignedByMe(assignedRes.data?.tasks || []);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [canAssign, managerFilter]);

  useEffect(() => { load(); }, [load]);

  const employeeMap = useMemo(
    () => new Map((employees || []).map((employee) => [String(employee.id), employee.name])),
    [employees],
  );

  const updateMyTask = async (taskId, payload) => {
    try {
      await api.patch(`/api/tasks/${taskId}/status`, payload);
      setMessage('Task updated successfully.');
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to update task.');
    }
  };

  const assignTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.post('/api/tasks', {
        title: assignForm.title,
        description: assignForm.description,
        assigned_to: Number(assignForm.assigned_to),
      });
      setAssignForm(INITIAL_ASSIGN_FORM);
      setMessage('Task assigned successfully.');
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to assign task.');
    } finally {
      setSaving(false);
    }
  };

  const manageTask = async (taskId, payload) => {
    try {
      await api.patch(`/api/tasks/${taskId}/manage`, payload);
      setMessage('Task updated by manager successfully.');
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to manage task.');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setMessage('Task deleted successfully.');
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to delete task.');
    }
  };

  if (loading) return <div className="p-6">Loading tasks...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Task Management</h1>
      {message ? <div className="rounded bg-blue-50 p-3 text-sm text-blue-700">{message}</div> : null}

      {canAssign && (
        <form onSubmit={assignTask} className="space-y-3 rounded border p-4 bg-white">
          <h2 className="font-semibold">Assign New Task</h2>
          <input className="w-full rounded border p-2" placeholder="Task title" value={assignForm.title} onChange={(e) => setAssignForm((f) => ({ ...f, title: e.target.value }))} required />
          <textarea className="w-full rounded border p-2" placeholder="Description" value={assignForm.description} onChange={(e) => setAssignForm((f) => ({ ...f, description: e.target.value }))} />
          <select className="w-full rounded border p-2" value={assignForm.assigned_to} onChange={(e) => setAssignForm((f) => ({ ...f, assigned_to: e.target.value }))} required>
            <option value="">Select employee</option>
            {employees.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
          <button disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white">{saving ? 'Assigning...' : 'Assign Task'}</button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">My Assigned Tasks (Employee View)</h2>
        {myTasks.map((task) => (
          <div key={task.id} className="rounded border p-4 bg-white space-y-2">
            <div className="font-medium">{task.title}</div>
            <div className="text-sm text-gray-600">{task.description || 'No description'}</div>
            <textarea className="w-full rounded border p-2" defaultValue={task.employee_update || ''} placeholder="What have you done regarding this task?" onBlur={(e) => updateMyTask(task.id, { status: task.status, employee_update: e.target.value })} />
            <select className="rounded border p-2" value={task.status} onChange={(e) => updateMyTask(task.id, { status: e.target.value, employee_update: task.employee_update || '' })}>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        ))}
        {myTasks.length === 0 && <p className="text-sm text-gray-500">No tasks assigned to you.</p>}
      </section>

      {canAssign && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Tasks I Issued (SCM/COO Management View)</h2>
            <select className="rounded border p-2 text-sm" value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>

          {assignedByMe.map((task) => (
            <div key={task.id} className="rounded border p-4 bg-white space-y-2">
              <input
                className="w-full rounded border p-2 font-medium"
                defaultValue={task.title}
                onBlur={(e) => manageTask(task.id, { title: e.target.value })}
              />
              <textarea
                className="w-full rounded border p-2 text-sm"
                defaultValue={task.description || ''}
                placeholder="Description"
                onBlur={(e) => manageTask(task.id, { description: e.target.value })}
              />
              <div className="grid gap-2 md:grid-cols-3">
                <select className="rounded border p-2" value={String(task.assigned_to)} onChange={(e) => manageTask(task.id, { assigned_to: Number(e.target.value) })}>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
                <select className="rounded border p-2" value={task.status} onChange={(e) => manageTask(task.id, { status: e.target.value })}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button type="button" className="rounded bg-red-600 px-3 py-2 text-white" onClick={() => deleteTask(task.id)}>Delete Task</button>
              </div>
              <div className="text-xs text-gray-600">Assigned to: {task.assigned_to_name || employeeMap.get(String(task.assigned_to)) || 'Unknown'}</div>
              <div className="text-xs text-gray-600">Employee progress: {task.employee_update || 'No update yet'}</div>
            </div>
          ))}
          {assignedByMe.length === 0 && <p className="text-sm text-gray-500">No tasks issued by you yet.</p>}
        </section>
      )}
    </div>
  );
}