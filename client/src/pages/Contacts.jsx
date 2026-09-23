import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import contactService from '../services/contactService';

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [contactType, setContactType] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    organization_name: '',
    contact_type: 'LEAD',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchContacts(1);
  }, [contactType]);

  const fetchContacts = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await contactService.getContacts({
        page,
        limit: 15,
        search,
        contact_type: contactType,
      });
      setContacts(res.data.items);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchContacts(1);
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError('');
      await contactService.createContact(formData);
      setShowModal(false);
      setFormData({
        first_name: '',
        last_name: '',
        display_name: '',
        email: '',
        phone: '',
        alternate_phone: '',
        organization_name: '',
        contact_type: 'LEAD',
        notes: '',
      });
      fetchContacts(1);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to soft delete contact "${name}"?`)) return;
    try {
      await contactService.deleteContact(id);
      fetchContacts(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete contact');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers Directory & Contacts</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Central relationship registry for clients, leads, opposing counsel, witnesses, and referral sources.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">+ Add New Contact</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
          <input
            type="text"
            placeholder="Search by name, email, phone, organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <select
          value={contactType}
          onChange={(e) => setContactType(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        >
          <option value="">All Contact Types</option>
          <option value="CLIENT">Client</option>
          <option value="LEAD">Lead</option>
          <option value="OPPOSING_COUNSEL">Opposing Counsel</option>
          <option value="WITNESS">Witness</option>
          <option value="REFERRAL_SOURCE">Referral Source</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Contacts Table */}
      <div className="card table-card-scroll" style={{ padding: '0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading Contacts...</div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No contacts match the current query.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Display Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contact Info</th>
                <th style={{ padding: '0.75rem 1rem' }}>Organization</th>
                <th style={{ padding: '0.75rem 1rem' }}>Tags</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/contacts/${c.id}`} style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                      {c.displayName}
                    </Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{
                      backgroundColor: c.contactType === 'CLIENT' ? 'var(--color-success-bg)' : c.contactType === 'OPPOSING_COUNSEL' ? '#fee2e2' : 'var(--color-bg-subtle)',
                      color: c.contactType === 'CLIENT' ? 'var(--color-success)' : c.contactType === 'OPPOSING_COUNSEL' ? 'var(--color-danger)' : 'inherit',
                    }}>
                      {c.contactType}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div>{c.email || '—'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{c.phone || '—'}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{c.organizationName || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {c.tags && c.tags.length > 0 ? (
                        c.tags.map((t) => (
                          <span key={t.id} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '3px', backgroundColor: t.color || '#1e3a8a', color: '#fff' }}>
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.75rem' }}>None</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <Link to={`/contacts/${c.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', marginRight: '0.5rem' }}>
                      View / 360°
                    </Link>
                    <button onClick={() => handleDelete(c.id, c.displayName)} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Showing Page {pagination.page} of {pagination.total_pages} ({pagination.total} contacts)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchContacts(pagination.page - 1)}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => fetchContacts(pagination.page + 1)}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create New Contact</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {modalError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}

            <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Display Name (or Business Entity Name)</label>
                <input
                  type="text"
                  placeholder="e.g. Adv. Rajesh Sharma or Apex Infra Ltd"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone (Primary)</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@domain.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact Type</label>
                  <select
                    value={formData.contact_type}
                    onChange={(e) => setFormData({ ...formData, contact_type: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="LEAD">Lead / Inquirer</option>
                    <option value="CLIENT">Direct Client</option>
                    <option value="OPPOSING_COUNSEL">Opposing Counsel</option>
                    <option value="WITNESS">Witness</option>
                    <option value="REFERRAL_SOURCE">Referral Source</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Organization / Chambers</label>
                  <input
                    type="text"
                    placeholder="e.g. State Bank of India"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Notes / Background</label>
                <textarea
                  rows="3"
                  placeholder="Intake notes or referral details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Creating Contact...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
