import React, { useState, useEffect } from 'react';
import followUpService from '../services/followUpService';
import contactService from '../services/contactService';
import { IconCheck, IconX, IconAlertTriangle, IconCalendar, IconHourglass } from '../components/common/Icons';

const FollowUps = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Complete Modal
  const [completeTargetId, setCompleteTargetId] = useState(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // New Follow-Up Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contact_id: '',
    title: '',
    description: '',
    follow_up_type: 'CALL',
    scheduled_for: new Date().toISOString().slice(0, 16),
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await followUpService.getSummary();
      setDashboard(res.data.dashboard);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load follow-ups summary');
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = async () => {
    try {
      setShowCreateModal(true);
      const res = await contactService.getContacts({ limit: 100 });
      setContacts(res.data.items || []);
    } catch (err) {
      alert('Failed to load contacts for assignment.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await followUpService.createFollowUp(formData);
      setShowCreateModal(false);
      setFormData({
        contact_id: '',
        title: '',
        description: '',
        follow_up_type: 'CALL',
        scheduled_for: new Date().toISOString().slice(0, 16),
      });
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create follow-up task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    try {
      setCompleting(true);
      await followUpService.completeFollowUp(completeTargetId, outcomeNotes);
      setCompleteTargetId(null);
      setOutcomeNotes('');
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this follow-up reminder?')) return;
    try {
      await followUpService.deleteFollowUp(id);
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete follow-up');
    }
  };

  const renderSection = (title, items, isOverdue = false, isCompleted = false, icon = null) => (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: isOverdue ? 'var(--color-danger)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon} {title} ({items?.length || 0})
        </h2>
      </div>

      {(!items || items.length === 0) ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
          No reminders in this view.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map((fu) => (
            <div key={fu.id} style={{
              padding: '0.75rem',
              backgroundColor: isOverdue ? '#f4f4f5' : 'var(--color-bg-subtle)',
              borderRadius: '4px',
              border: isOverdue ? '1px solid #000000' : '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge" style={{ fontSize: '0.7rem' }}>{fu.followUpType}</span>
                  <strong style={{ fontSize: '0.9rem' }}>{fu.title}</strong>
                </div>
                {fu.contactName && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    Party: <strong>{fu.contactName}</strong> &bull; Assigned: {fu.assignedToName}
                  </div>
                )}
                {fu.description && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', marginTop: '0.3rem', whiteSpace: 'pre-wrap' }}>
                    {fu.description}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.3rem' }}>
                  Due: {new Date(fu.scheduledFor).toLocaleString()}
                  {fu.completedAt && ` | Completed: ${new Date(fu.completedAt).toLocaleString()}`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {!isCompleted && (
                  <button
                    onClick={() => { setCompleteTargetId(fu.id); setOutcomeNotes(''); }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <IconCheck size={12} /> Complete
                  </button>
                )}
                <button
                  onClick={() => handleDelete(fu.id)}
                  style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '2px' }}
                  title="Delete"
                >
                  <IconX size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers Follow-ups & Reminders</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Action items grouped by urgency: Overdue, Due Today, Upcoming 7 Days, and Recently Completed.
          </p>
        </div>
        <button onClick={openNewModal} className="btn btn-primary">+ Schedule Follow-up</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* 4 Quadrants Dashboard */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading Chambers Follow-ups...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {renderSection('Overdue Pending Actions', dashboard?.overdue, true, false, <IconAlertTriangle size={16} color="#000000" />)}
          {renderSection('Due Today', dashboard?.today, false, false, <IconCalendar size={16} color="#000000" />)}
          {renderSection('Upcoming (Next 7 Days)', dashboard?.upcoming, false, false, <IconHourglass size={16} color="#000000" />)}
          {renderSection('Recently Completed', dashboard?.completed, false, true, <IconCheck size={16} color="#000000" />)}
        </div>
      )}

      {/* Complete Outcome Notes Modal */}
      {completeTargetId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>Complete Follow-up Task</h2>
            <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Outcome Notes / Call Summary</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Record summary of call, client response, agreement..."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setCompleteTargetId(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={completing} className="btn btn-primary">
                  {completing ? 'Saving...' : 'Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Schedule New Follow-up</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Associated Contact / Client</label>
                <select
                  value={formData.contact_id}
                  onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="">-- Optional: Link to Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.phone || c.email || 'No contact details'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Follow-up Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call client regarding additional documents"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Communication Type</label>
                  <select
                    value={formData.follow_up_type}
                    onChange={(e) => setFormData({ ...formData, follow_up_type: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="PAYMENT">Retainer / Fee Discussion</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.scheduled_for}
                    onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Task Instructions / Context</label>
                <textarea
                  rows="3"
                  placeholder="Context for associate or chambers desk..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Scheduling...' : 'Save Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUps;
