import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import crmService from '../services/crmService';
import { IconCheck, IconAlertTriangle } from '../components/common/Icons';

const CrmDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Conflict Search quick tool
  const [conflictSearch, setConflictSearch] = useState({ name: '', phone: '', email: '', organization: '' });
  const [conflictResults, setConflictResults] = useState(null);
  const [conflictSearching, setConflictSearching] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await crmService.getDashboardStats();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load CRM dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleConflictCheck = async (e) => {
    e.preventDefault();
    try {
      setConflictSearching(true);
      const res = await crmService.checkConflict(conflictSearch);
      setConflictResults(res.data?.conflicts || res.data?.possible_matches || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Conflict check failed');
    } finally {
      setConflictSearching(false);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Loading Chambers CRM Overview...</div>;
  }

  const metrics = data?.metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers CRM & Practice Intelligence</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Unified view of inquiries, pipeline velocity, consultations, client onboarding, and conflict clearance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/contacts" className="btn btn-primary">+ New Contact</Link>
          <Link to="/leads" className="btn btn-secondary">+ Log Inquiry</Link>
          <Link to="/appointments" className="btn btn-secondary">Calendar</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Contacts</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '0.25rem' }}>{metrics.totalContacts ?? 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Central Chambers Directory</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Retained Clients</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>{metrics.activeClients ?? 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Formal representation</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Lead Pipeline</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)', marginTop: '0.25rem' }}>{metrics.openLeads ?? 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Inquiries & Consultations</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Scheduled Consultations</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#7c3aed', marginTop: '0.25rem' }}>{metrics.consultationsScheduled ?? 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Ready for interview</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Follow-ups</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: metrics.overdueFollowUps > 0 ? 'var(--color-danger)' : 'var(--color-secondary)', marginTop: '0.25rem' }}>
            {metrics.pendingFollowUps ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: metrics.overdueFollowUps > 0 ? 'var(--color-danger)' : 'var(--color-text-subtle)', marginTop: '0.25rem' }}>
            {metrics.overdueFollowUps > 0 ? `${metrics.overdueFollowUps} Overdue` : 'All tasks on schedule'}
          </div>
        </div>
      </div>

      {/* Main Grid: Conflict Checker & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Instant Conflict of Interest Search Tool */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)' }}>Instant Conflict-of-Interest Check</h2>
            <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>Chambers Compliance</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Screen prospective parties against opposing counsel, existing clients, witnesses, and previous matters before intake.
          </p>

          <form onSubmit={handleConflictCheck} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-secondary)' }}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Chandra"
                className="input-field"
                value={conflictSearch.name}
                onChange={(e) => setConflictSearch({ ...conflictSearch, name: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-secondary)' }}>Phone Number</label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                className="input-field"
                value={conflictSearch.phone}
                onChange={(e) => setConflictSearch({ ...conflictSearch, phone: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-secondary)' }}>Email Address</label>
              <input
                type="email"
                placeholder="e.g. party@org.in"
                className="input-field"
                value={conflictSearch.email}
                onChange={(e) => setConflictSearch({ ...conflictSearch, email: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-secondary)' }}>Company / Entity</label>
              <input
                type="text"
                placeholder="e.g. Apex Infra Ltd"
                className="input-field"
                value={conflictSearch.organization}
                onChange={(e) => setConflictSearch({ ...conflictSearch, organization: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={conflictSearching}>
                {conflictSearching ? 'Scanning Chambers Database...' : 'Run Conflict Check'}
              </button>
            </div>
          </form>

          {/* Conflict Results Area */}
          {conflictResults !== null && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Screening Results: {conflictResults.length === 0 ? (
                  <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <IconCheck size={14} /> No Conflicts Detected
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <IconAlertTriangle size={14} /> {conflictResults.length} Potential Match(es) Found
                  </span>
                )}
              </div>

              {conflictResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {conflictResults.map((c) => (
                    <div key={c.id} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{c.displayName || `${c.firstName || ''} ${c.lastName || ''}`}</strong>
                        <span className="badge" style={{ backgroundColor: c.contactType === 'CLIENT' ? '#000000' : '#f4f4f5', color: c.contactType === 'CLIENT' ? '#ffffff' : '#000000', border: '1px solid #000000', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {c.contactType}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        {c.email && `Email: ${c.email} | `}
                        {c.phone && `Phone: ${c.phone} | `}
                        {c.organizationName && `Org: ${c.organizationName}`}
                      </div>
                      {c.clientCode && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginTop: '0.25rem' }}>
                          Client Code: <strong>{c.clientCode}</strong> (Status: {c.clientStatus})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Inquiries & Today's Appointments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Today's Appointments */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)' }}>Today's Chambers Hearings & Consultations</h2>
              <Link to="/appointments" style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>View Calendar &rarr;</Link>
            </div>

            {(!data?.todayAppointments || data.todayAppointments.length === 0) ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                No appointments or consultations scheduled for today.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.todayAppointments.map((apt) => (
                  <div key={apt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{apt.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        With: {apt.contactName || 'Unassigned'} &bull; Assigned: {apt.assignedTo}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>{apt.startTime} - {apt.endTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Leads Pipeline */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)' }}>Recent Inquiries (Intake)</h2>
              <Link to="/leads" style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>Pipeline Board &rarr;</Link>
            </div>

            {(!data?.recentLeads || data.recentLeads.length === 0) ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                No recent lead inquiries recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.recentLeads.map((ld) => (
                  <div key={ld.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <Link to={`/leads/${ld.id}`} style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                        {ld.contactName}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Source: {ld.source}</div>
                    </div>
                    <span className="badge" style={{ fontSize: '0.75rem', backgroundColor: ld.status === 'CONSULTATION_SCHEDULED' ? '#ede9fe' : '#f1f5f9', color: ld.status === 'CONSULTATION_SCHEDULED' ? '#6d28d9' : 'inherit' }}>
                      {ld.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CrmDashboard;
