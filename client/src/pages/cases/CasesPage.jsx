import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import caseService from '../../services/caseService';
import courtService from '../../services/courtService';
import { useAuth } from '../../context/AuthContext';

const CasesPage = () => {
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dashboard Stats
  const [dashboard, setDashboard] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [caseStatus, setCaseStatus] = useState('');
  const [caseStage, setCaseStage] = useState('');
  const [courtId, setCourtId] = useState('');
  const [courts, setCourts] = useState([]);

  useEffect(() => {
    fetchDashboard();
    fetchCourts();
    fetchCases(1);
  }, [caseStatus, caseStage, courtId]);

  const fetchDashboard = async () => {
    try {
      const res = await caseService.getDashboard();
      setDashboard(res.data);
    } catch (err) {
      console.error('Failed to load case dashboard:', err);
    }
  };

  const fetchCourts = async () => {
    try {
      const res = await courtService.getCourts({ limit: 100, is_active: true });
      setCourts(res.data.items || []);
    } catch (err) {
      console.error('Failed to load courts:', err);
    }
  };

  const fetchCases = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await caseService.getCases({
        page,
        limit: 15,
        search,
        case_status: caseStatus,
        case_stage: caseStage,
        court_id: courtId,
      });
      setCases(res.data.items);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load case records');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCases(1);
  };

  const metrics = dashboard?.metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Court Cases & Matters</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Master chambers docket with stage progression, CNR verification, next hearing tracking, and advocate assignments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/cause-list" className="btn btn-secondary">Daily Cause List</Link>
          {hasPermission('CASE_CREATE') && (
            <Link to="/cases/new" className="btn btn-primary">+ Open New Case</Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* KPI Overview */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Matters</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>{metrics.activeCases ?? 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Ongoing Representation</div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Stayed Matters</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.25rem' }}>{metrics.stayedCases ?? 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Interim Injunctions</div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Today's Hearings</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-accent)', marginTop: '0.25rem' }}>{metrics.todayHearings ?? 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Court Appearances</div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tomorrow's Hearings</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#7c3aed', marginTop: '0.25rem' }}>{metrics.tomorrowHearings ?? 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Brief Preparation</div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Disposed / Closed</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-secondary)', marginTop: '0.25rem' }}>{metrics.disposedCases ?? 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Concluded Matters</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search by case number, CNR, title, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <select
          value={caseStatus}
          onChange={(e) => setCaseStatus(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="STAYED">Stayed</option>
          <option value="DISPOSED">Disposed</option>
          <option value="CLOSED">Closed</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>

        <select
          value={caseStage}
          onChange={(e) => setCaseStage(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
        >
          <option value="">All Stages</option>
          <option value="NEW">New</option>
          <option value="FILED">Filed</option>
          <option value="ADMITTED">Admitted</option>
          <option value="NOTICE">Notice</option>
          <option value="PLEADINGS">Pleadings</option>
          <option value="EVIDENCE">Evidence</option>
          <option value="ARGUMENTS">Arguments</option>
          <option value="JUDGMENT">Judgment</option>
          <option value="ORDER">Order</option>
          <option value="APPEAL">Appeal</option>
          <option value="EXECUTION">Execution</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', maxWidth: '200px' }}
        >
          <option value="">All Courts</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Cases Table */}
      <div className="card table-card-scroll" style={{ padding: '0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading Chambers Docket...</div>
        ) : cases.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No cases match the current query.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Case Details</th>
                <th style={{ padding: '0.75rem 1rem' }}>Court & Forum</th>
                <th style={{ padding: '0.75rem 1rem' }}>Primary Client</th>
                <th style={{ padding: '0.75rem 1rem' }}>Stage & Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Next Hearing Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Assigned Team</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((cs) => (
                <tr key={cs.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/cases/${cs.id}`} style={{ fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}>
                      {cs.title}
                    </Link>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                      <strong>{cs.caseNumber}</strong> &bull; {cs.caseType}
                    </div>
                    {cs.cnrNumber && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>CNR: {cs.cnrNumber}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 500 }}>{cs.court?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{cs.court?.city}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div><strong>{cs.client?.name}</strong></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>{cs.client?.clientCode}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                      <span className="badge" style={{
                        backgroundColor: cs.caseStatus === 'ACTIVE' ? 'var(--color-success-bg)' : cs.caseStatus === 'STAYED' ? 'var(--color-warning-bg)' : '#fee2e2',
                        color: cs.caseStatus === 'ACTIVE' ? 'var(--color-success)' : cs.caseStatus === 'STAYED' ? 'var(--color-warning)' : 'var(--color-danger)'
                      }}>
                        {cs.caseStatus}
                      </span>
                      <span className="badge" style={{ backgroundColor: 'var(--color-bg-subtle)', fontSize: '0.7rem' }}>
                        {cs.caseStage}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {cs.nextHearingDate ? (
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {new Date(cs.nextHearingDate).toLocaleDateString()}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>No hearing date</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {cs.assignedUsers && cs.assignedUsers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                        {cs.assignedUsers.map((u, i) => (
                          <span key={i}>&bull; {u.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <Link to={`/cases/${cs.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>
                      Dossier &rarr;
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
            Showing Page {pagination.page} of {pagination.total_pages} ({pagination.total} cases)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchCases(pagination.page - 1)}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => fetchCases(pagination.page + 1)}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasesPage;
