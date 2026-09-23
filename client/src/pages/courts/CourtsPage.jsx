import React, { useState, useEffect } from 'react';
import courtService from '../../services/courtService';
import { useAuth } from '../../context/AuthContext';

const CourtsPage = () => {
  const { hasPermission } = useAuth();
  const [courts, setCourts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [courtType, setCourtType] = useState('');
  const [city, setCity] = useState('');
  const [isActive, setIsActive] = useState('');

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    court_type: 'DISTRICT_COURT',
    location: '',
    city: '',
    state: '',
    address: '',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchCourts(1);
  }, [courtType, isActive]);

  const fetchCourts = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await courtService.getCourts({
        page,
        limit: 15,
        search,
        court_type: courtType,
        city,
        is_active: isActive,
      });
      setCourts(res.data.items);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courts registry');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCourts(1);
  };

  const openCreateModal = () => {
    setModalMode('CREATE');
    setSelectedCourtId(null);
    setFormData({
      name: '',
      code: '',
      court_type: 'DISTRICT_COURT',
      location: '',
      city: 'New Delhi',
      state: 'Delhi',
      address: '',
      is_active: true,
    });
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setModalMode('EDIT');
    setSelectedCourtId(c.id);
    setFormData({
      name: c.name,
      code: c.code || '',
      court_type: c.courtType,
      location: c.location || '',
      city: c.city,
      state: c.state,
      address: c.address || '',
      is_active: c.isActive,
    });
    setModalError('');
    setShowModal(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError('');
      if (modalMode === 'CREATE') {
        await courtService.createCourt(formData);
      } else {
        await courtService.updateCourt(selectedCourtId, formData);
      }
      setShowModal(false);
      fetchCourts(pagination.page);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save court');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate or remove court "${name}" from registry?`)) return;
    try {
      const res = await courtService.deleteCourt(id);
      alert(res.message);
      fetchCourts(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete court');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Court & Tribunal Registry</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Comprehensive jurisdiction database across Supreme Court, High Courts, District Benches, and Tribunals.
          </p>
        </div>
        {hasPermission('COURT_CREATE') && (
          <button onClick={openCreateModal} className="btn btn-primary">+ Register Court</button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search by court name, code, city, state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <select
          value={courtType}
          onChange={(e) => setCourtType(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        >
          <option value="">All Court Types</option>
          <option value="SUPREME_COURT">Supreme Court</option>
          <option value="HIGH_COURT">High Court</option>
          <option value="DISTRICT_COURT">District Court</option>
          <option value="SESSIONS_COURT">Sessions Court</option>
          <option value="MAGISTRATE_COURT">Magistrate Court</option>
          <option value="FAMILY_COURT">Family Court</option>
          <option value="CIVIL_COURT">Civil Court</option>
          <option value="CRIMINAL_COURT">Criminal Court</option>
          <option value="TRIBUNAL">Tribunal / Commission</option>
          <option value="OTHER">Other</option>
        </select>

        <select
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        >
          <option value="">All Statuses</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {/* Courts Table */}
      <div className="card table-card-scroll" style={{ padding: '0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading Registry...</div>
        ) : courts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No courts match the current criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Court Name & Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Court Level / Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Jurisdiction & City</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{c.name}</div>
                    {c.code && <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>Code: {c.code}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                      {c.courtType}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div>{c.city}, {c.state}</div>
                    {c.location && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.location}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{
                      backgroundColor: c.isActive ? 'var(--color-success-bg)' : '#fee2e2',
                      color: c.isActive ? 'var(--color-success)' : 'var(--color-danger)'
                    }}>
                      {c.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {hasPermission('COURT_UPDATE') && (
                      <button
                        onClick={() => openEditModal(c)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                      >
                        Edit
                      </button>
                    )}
                    {hasPermission('COURT_DELETE') && (
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                      >
                        Deactivate
                      </button>
                    )}
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
            Showing Page {pagination.page} of {pagination.total_pages} ({pagination.total} registered courts)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchCourts(pagination.page - 1)}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => fetchCourts(pagination.page + 1)}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Court */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {modalMode === 'CREATE' ? 'Register New Court' : 'Edit Court Details'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {modalError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Court / Bench Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High Court of Delhi"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Court Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. DEL-HC"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Court Level</label>
                  <select
                    value={formData.court_type}
                    onChange={(e) => setFormData({ ...formData, court_type: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="SUPREME_COURT">Supreme Court</option>
                    <option value="HIGH_COURT">High Court</option>
                    <option value="DISTRICT_COURT">District Court</option>
                    <option value="SESSIONS_COURT">Sessions Court</option>
                    <option value="MAGISTRATE_COURT">Magistrate Court</option>
                    <option value="FAMILY_COURT">Family Court</option>
                    <option value="CIVIL_COURT">Civil Court</option>
                    <option value="CRIMINAL_COURT">Criminal Court</option>
                    <option value="TRIBUNAL">Tribunal / Commission</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. New Delhi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>State</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Delhi"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bench / Complex Location</label>
                <input
                  type="text"
                  placeholder="e.g. Sher Shah Road or Tis Hazari Complex"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Address / PIN</label>
                <textarea
                  rows="2"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="court_active_toggle"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="court_active_toggle" style={{ fontSize: '0.85rem' }}>Court is Active for Filings</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save Court'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourtsPage;
