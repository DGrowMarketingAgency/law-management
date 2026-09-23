import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clientService from '../services/clientService';
import contactService from '../services/contactService';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // New Client Modal
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contact_id: '',
    client_source: 'DIRECT',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchClients(1);
  }, [status]);

  const fetchClients = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await clientService.getClients({
        page,
        limit: 15,
        search,
        status,
      });
      setClients(res.data.items);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  const openNewClientModal = async () => {
    try {
      setShowModal(true);
      setModalError('');
      // Fetch available contacts for onboarding
      const res = await contactService.getContacts({ limit: 100 });
      setContacts(res.data.items || []);
    } catch (err) {
      setModalError('Failed to load contacts list for selection.');
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!formData.contact_id) {
      setModalError('Please select a contact from the registry.');
      return;
    }
    try {
      setSubmitting(true);
      setModalError('');
      await clientService.createClient(formData);
      setShowModal(false);
      setFormData({ contact_id: '', client_source: 'DIRECT', notes: '' });
      fetchClients(1);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to onboard client.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers Retained Clients</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Formally onboarded client records with sequential chambers codes (CL-XXXXXX) and compliance tracking.
          </p>
        </div>
        <button onClick={openNewClientModal} className="btn btn-primary">+ Onboard Client</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={(e) => { e.preventDefault(); fetchClients(1); }} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
          <input
            type="text"
            placeholder="Search by client code, name, phone, email, organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        >
          <option value="">All Client Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Clients Table */}
      <div className="card table-card-scroll" style={{ padding: '0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading Client Directory...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No clients match the current query.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Client Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Client Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Source</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contact Info</th>
                <th style={{ padding: '0.75rem 1rem' }}>Retained On</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((cl) => (
                <tr key={cl.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/clients/${cl.id}`} style={{ fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none' }}>
                      {cl.clientCode}
                    </Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <strong>{cl.contact?.displayName}</strong>
                    {cl.contact?.organizationName && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{cl.contact.organizationName}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{
                      backgroundColor: cl.status === 'ACTIVE' ? 'var(--color-success-bg)' : '#fee2e2',
                      color: cl.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {cl.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>{cl.clientSource}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div>{cl.contact?.email || '—'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{cl.contact?.phone || '—'}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {new Date(cl.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <Link to={`/clients/${cl.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>
                      Profile & Consents &rarr;
                    </Link>
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
            Showing Page {pagination.page} of {pagination.total_pages} ({pagination.total} clients)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchClients(pagination.page - 1)}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => fetchClients(pagination.page + 1)}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Onboard Client Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Onboard New Chambers Client</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {modalError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}

            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Select Existing Contact</label>
                <select
                  required
                  value={formData.contact_id}
                  onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.phone || c.email || 'No contact info'}) - {c.contactType}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  A sequential client code (e.g. CL-000001) will automatically be allocated.
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Client Onboarding Source</label>
                <select
                  value={formData.client_source}
                  onChange={(e) => setFormData({ ...formData, client_source: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="DIRECT">Direct Inquiry</option>
                  <option value="EXISTING_CLIENT">Referred by Existing Client</option>
                  <option value="COLLEAGUE_ADVOCATE">Colleague Advocate</option>
                  <option value="BAR_ASSOCIATION">Bar Association / Legal Aid</option>
                  <option value="ONLINE_PORTAL">Online Portal</option>
                  <option value="OTHER">Other Source</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Retention Notes</label>
                <textarea
                  rows="3"
                  placeholder="Terms of engagement, vakalatnama status, notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Allocating Client Code...' : 'Confirm Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
