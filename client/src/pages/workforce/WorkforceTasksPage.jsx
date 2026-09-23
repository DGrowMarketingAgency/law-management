import React, { useState, useEffect } from 'react';
import { workforceService } from '../../services/workforceService';
import { useAuth } from '../../context/AuthContext';
import { IconCheckSquare, IconSearch, IconClose } from '../../components/common/Icons';

const WorkforceTasksPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    task_type: 'RESEARCH',
    priority: 'MEDIUM',
    assigned_to: '',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    estimated_hours: 4,
    related_case_id: '',
  });

  const [members, setMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await workforceService.getTasks({
        status: statusFilter,
        priority: priorityFilter,
        search,
      });
      if (res.success) {
        setTasks(res.tasks || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await workforceService.getDirectory({ limit: 100 });
      if (res.success) {
        setMembers(res.profiles || []);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, [statusFilter, priorityFilter]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await workforceService.createTask(taskForm);
      setShowAddModal(false);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await workforceService.updateTask(taskId, { status: newStatus });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const getPriorityBadge = (priority) => {
    const map = {
      URGENT: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
      HIGH: { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' },
      MEDIUM: { bg: '#eff6ff', color: '#1d4ed8', border: '#dbeafe' },
      LOW: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
    };
    const c = map[priority] || map.MEDIUM;
    return (
      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
        {priority}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
            Chambers Internal Tasks & Research Delegation
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Legal research briefs, synopsis drafting, case study delegations, and procedural filing tasks.
          </p>
        </div>

        <button
          onClick={() => {
            if (members.length > 0 && !taskForm.assigned_to) {
              setTaskForm((prev) => ({ ...prev, assigned_to: members[0].user_id || user.id }));
            }
            setShowAddModal(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '6px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          + Create Task
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px' }}>
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTasks()}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: '0 1 160px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div style={{ flex: '0 1 160px' }}>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Task Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p style={{ color: '#64748b' }}>No tasks found matching the criteria.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{t.task_code}</span>
                  {getPriorityBadge(t.priority)}
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                  {t.title}
                </h3>

                {t.description && (
                  <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                    {t.description}
                  </p>
                )}

                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
                  <div><strong>Assignee:</strong> {t.assignee_first_name} {t.assignee_last_name}</div>
                  <div><strong>Due Date:</strong> {t.due_date}</div>
                  {t.case_number && <div><strong>Case:</strong> {t.case_number} ({t.case_title})</div>}
                  <div><strong>Hours:</strong> {t.actual_hours > 0 ? `${t.actual_hours}h logged` : `Est: ${t.estimated_hours}h`}</div>
                </div>
              </div>

              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: t.status === 'COMPLETED' ? '#15803d' : '#2563eb' }}>
                  Status: {t.status}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {t.status !== 'IN_PROGRESS' && t.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Start
                    </button>
                  )}
                  {t.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '500px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px' }}>Create New Chambers Task</h3>
            <form onSubmit={handleCreateTask}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal Research on Section 9 A&C Act"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Description / Synopsis Scope</label>
                <textarea
                  rows="3"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Task Type</label>
                  <select
                    value={taskForm.task_type}
                    onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    <option value="RESEARCH">Legal Research</option>
                    <option value="DRAFTING">Drafting</option>
                    <option value="CASE">Case Prep</option>
                    <option value="COURT">Court Appearance Prep</option>
                    <option value="DOCUMENT">Document Review</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Assign To Member *</label>
                  <select
                    required
                    value={taskForm.assigned_to}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user_id || user.id}>
                        {m.first_name} {m.last_name} ({m.designation})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Due Date *</label>
                  <input
                    type="date"
                    required
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: '600' }}>Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceTasksPage;
