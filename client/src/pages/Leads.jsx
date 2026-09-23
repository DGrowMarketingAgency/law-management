import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import leadService from '../services/leadService';
import contactService from '../services/contactService';
import { IconPhone } from '../components/common/Icons';

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Inquiry Modal
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contact_id: '',
    source: 'DIRECT',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await leadService.getLeads({ limit: 100 });
      setLeads(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lead pipeline');
    } finally {
      setLoading(false);
    }
  };

  const openNewInquiryModal = async () => {
    try {
      setShowModal(true);
      setModalError('');
      const res = await contactService.getContacts({ limit: 100 });
      setContacts(res.data.items || []);
    } catch (err) {
      setModalError('Failed to load contacts for selection');
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!formData.contact_id) {
      setModalError('Please select a contact from the registry.');
      return;
    }
    try {
      setSubmitting(true);
      setModalError('');
      await leadService.createLead(formData);
      setShowModal(false);
      setFormData({ contact_id: '', source: 'DIRECT', notes: '' });
      fetchLeads();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to record lead inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  // Group leads by pipeline stages
  const columns = [
    { key: 'INQUIRY', title: '1. Initial Inquiries', badgeColor: '#e0f2fe', textColor: '#0369a1' },
    { key: 'CONSULTATION_SCHEDULED', title: '2. Consultation Scheduled', badgeColor: '#ede9fe', textColor: '#6d28d9' },
    { key: 'CONSULTATION_DONE', title: '3. Consultation Completed', badgeColor: '#fef3c7', textColor: '#b45309' },
    { key: 'RETAINED', title: '4. Retained Clients', badgeColor: 'var(--color-success-bg)', textColor: 'var(--color-success)' },
    { key: 'NOT_CONVERTED', title: 'Closed / Not Converted', badgeColor: '#fee2e2', textColor: 'var(--color-danger)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers Intake & Leads Pipeline</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Strict state-machine tracking: Inquiry &rarr; Consultation Scheduled &rarr; Consultation Done &rarr; Retained.
          </p>
        </div>
        <button onClick={openNewInquiryModal} className="btn btn-primary">+ Log New Inquiry</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Kanban Pipeline Board */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading Chambers Pipeline Board...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'start' }}>
          {columns.map((col) => {
            const colLeads = leads.filter((l) => l.status === col.key);
            return (
              <div key={col.key} style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: '6px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-secondary)' }}>{col.title}</div>
                  <span className="badge" style={{ backgroundColor: col.badgeColor, color: col.textColor, fontSize: '0.75rem' }}>
                    {colLeads.length}
                  </span>
                </div>

                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '300px', maxHeight: '75vh', overflowY: 'auto' }}>
                  {colLeads.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.8rem', padding: '2rem 0' }}>
                      No matters in this stage
                    </div>
                  ) : (
                    colLeads.map((ld) => (
                      <div key={ld.id} className="card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Link to={`/leads/${ld.id}`} style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
                            {ld.contact?.displayName}
                          </Link>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>#{ld.id}</span>
                        </div>

                        {ld.contact?.phone && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconPhone size={13} /> {ld.contact.phone}
                          </div>
                        )}

                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                          Source: <strong>{ld.source}</strong> &bull; Assigned: {ld.assignedTo?.name || 'Chambers'}
                        </div>

                        {ld.notConvertedReason && (
                          <div style={{ fontSize: '0.75rem', color: '#000000', backgroundColor: '#f4f4f5', border: '1px solid #d4d4d8', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
                            Reason: {ld.notConvertedReason}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                            {new Date(ld.createdAt).toLocaleDateString()}
                          </span>
                          <Link to={`/leads/${ld.id}`} style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>
                            Manage &rarr;
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log New Inquiry Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Log New Client Inquiry</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {modalError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact Profile</label>
                <select
                  required
                  value={formData.contact_id}
                  onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="">-- Select Contact from Directory --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.phone || c.email || 'No contact details'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Inquiry Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="DIRECT">Direct Walk-in / Phone</option>
                  <option value="EXISTING_CLIENT">Existing Client Referral</option>
                  <option value="COLLEAGUE_ADVOCATE">Colleague Advocate</option>
                  <option value="BAR_ASSOCIATION">Bar Association</option>
                  <option value="ONLINE_PORTAL">Website / Email Portal</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Inquiry Summary & Matter Overview</label>
                <textarea
                  rows="3"
                  placeholder="Subject of legal dispute, jurisdiction, urgency..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Recording Inquiry...' : 'Save to Pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
