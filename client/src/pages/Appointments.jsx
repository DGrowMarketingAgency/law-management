import React, { useState, useEffect } from 'react';
import appointmentService from '../services/appointmentService';
import contactService from '../services/contactService';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Schedule Modal
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contact_id: '',
    title: '',
    appointment_type: 'CONSULTATION',
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: '14:00',
    end_time: '15:00',
    location: 'Chambers Conference Room A',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await appointmentService.getAppointments({ limit: 100 });
      setAppointments(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = async () => {
    try {
      setShowModal(true);
      setModalError('');
      const res = await contactService.getContacts({ limit: 100 });
      setContacts(res.data.items || []);
    } catch (err) {
      setModalError('Failed to load contacts list.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError('');
      // ensure HH:MM:SS format
      const payload = {
        ...formData,
        start_time: formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time,
        end_time: formData.end_time.length === 5 ? `${formData.end_time}:00` : formData.end_time,
      };
      await appointmentService.createAppointment(payload);
      setShowModal(false);
      fetchAppointments();
    } catch (err) {
      // Highlights 409 conflict detection
      setModalError(err.response?.data?.message || 'Failed to schedule appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await appointmentService.updateAppointment(id, { status });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Cancel and delete this appointment record?')) return;
    try {
      await appointmentService.deleteAppointment(id);
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete appointment');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers Consultations & Hearings Calendar</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Advocate schedule manager with automatic conflict detection to prevent double-booking.
          </p>
        </div>
        <button onClick={openNewModal} className="btn btn-primary">+ Schedule Appointment</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Appointments List */}
      <div className="card table-card-scroll" style={{ padding: '0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading Calendar...</div>
        ) : appointments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No appointments scheduled in chambers calendar.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Title & Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Party / Contact</th>
                <th style={{ padding: '0.75rem 1rem' }}>Date & Slot</th>
                <th style={{ padding: '0.75rem 1rem' }}>Venue / Location</th>
                <th style={{ padding: '0.75rem 1rem' }}>Assigned Advocate</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <strong>{apt.title}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{apt.appointmentType}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div>{apt.contact?.displayName || 'Direct Appointment'}</div>
                    {apt.contact?.phone && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{apt.contact.phone}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div><strong>{new Date(apt.appointmentDate).toLocaleDateString()}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{apt.startTime} - {apt.endTime}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{apt.location || 'Chambers'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{apt.assignedTo?.name || 'Unassigned'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <select
                      value={apt.status}
                      onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                      style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}
                    >
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="RESCHEDULED">RESCHEDULED</option>
                      <option value="NO_SHOW">NO_SHOW</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(apt.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Schedule Consultation / Appointment</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {modalError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                <strong>Scheduling Conflict:</strong> {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Preliminary Case Assessment"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Appointment Type</label>
                  <select
                    value={formData.appointment_type}
                    onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="CONSULTATION">Preliminary Consultation</option>
                    <option value="CLIENT_MEETING">Client Strategy Meeting</option>
                    <option value="COURT_RELATED">Court Briefing / Conference</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact / Party</label>
                  <select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="">-- Optional: Link Contact --</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.phone || c.email || 'No contact info'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Appointment Date</label>
                <input
                  type="date"
                  required
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Venue / Location / Mode</label>
                <input
                  type="text"
                  placeholder="e.g. Chambers Conference Room A or Google Meet"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Agenda / Agenda Items</label>
                <textarea
                  rows="2"
                  placeholder="Brief agenda or instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Checking Conflict & Scheduling...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
