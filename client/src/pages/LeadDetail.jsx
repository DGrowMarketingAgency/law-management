import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import leadService from '../services/leadService';

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status update state
  const [transitioning, setTransitioning] = useState(false);
  const [notConvertedReason, setNotConvertedReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  // New Activity Note state
  const [activityData, setActivityData] = useState({ activity_type: 'NOTE', subject: '', description: '' });
  const [submittingAct, setSubmittingAct] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await leadService.getLeadById(id);
      setLead(res.data.lead);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inquiry record');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusTransition = async (newStatus) => {
    if (newStatus === 'NOT_CONVERTED') {
      setShowReasonModal(true);
      return;
    }

    try {
      setTransitioning(true);
      await leadService.updateLead(id, { status: newStatus });
      fetchLead();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to transition lead status');
    } finally {
      setTransitioning(false);
    }
  };

  const handleConfirmNotConverted = async (e) => {
    e.preventDefault();
    if (!notConvertedReason.trim()) {
      alert('A valid reason is required when closing a lead as not converted.');
      return;
    }
    try {
      setTransitioning(true);
      await leadService.updateLead(id, {
        status: 'NOT_CONVERTED',
        not_converted_reason: notConvertedReason.trim(),
      });
      setShowReasonModal(false);
      fetchLead();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update lead');
    } finally {
      setTransitioning(false);
    }
  };

  const handleConvertLead = async () => {
    if (!window.confirm('Convert this lead to a formally retained Client? This will allocate a sequential client code and record a transaction.')) return;
    try {
      setTransitioning(true);
      const res = await leadService.convertLead(id, { notes: 'Converted from consultation workflow.' });
      alert(`Lead successfully converted! Client Code: ${res.data?.client?.clientCode || 'Assigned'}`);
      navigate(`/clients/${res.data?.client?.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to convert lead to client');
      setTransitioning(false);
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAct(true);
      await leadService.addActivity(id, activityData);
      setActivityData({ activity_type: 'NOTE', subject: '', description: '' });
      fetchLead();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record activity log');
    } finally {
      setSubmittingAct(false);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading Inquiry Pipeline Record...</div>;
  }

  if (error || !lead) {
    return <div className="alert alert-danger">{error || 'Lead not found'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
            <Link to="/leads" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>&larr; Back to Pipeline Board</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Inquiry #{lead.id} &bull; {lead.contact?.displayName}
            </h1>
            <span className="badge" style={{
              backgroundColor: lead.status === 'RETAINED' ? 'var(--color-success-bg)' : lead.status === 'NOT_CONVERTED' ? '#fee2e2' : '#e0f2fe',
              color: lead.status === 'RETAINED' ? 'var(--color-success)' : lead.status === 'NOT_CONVERTED' ? 'var(--color-danger)' : '#0369a1'
            }}>
              {lead.status}
            </span>
          </div>
        </div>

        {/* Action Controls based on State Machine */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {lead.status === 'INQUIRY' && (
            <button
              disabled={transitioning}
              onClick={() => handleStatusTransition('CONSULTATION_SCHEDULED')}
              className="btn btn-secondary"
            >
              Schedule Consultation &rarr;
            </button>
          )}

          {lead.status === 'CONSULTATION_SCHEDULED' && (
            <button
              disabled={transitioning}
              onClick={() => handleStatusTransition('CONSULTATION_DONE')}
              className="btn btn-secondary"
            >
              Mark Consultation Done &rarr;
            </button>
          )}

          {lead.status === 'CONSULTATION_DONE' && (
            <button
              disabled={transitioning}
              onClick={handleConvertLead}
              className="btn btn-primary"
            >
              Convert to Retained Client &rarr;
            </button>
          )}

          {lead.status !== 'RETAINED' && lead.status !== 'NOT_CONVERTED' && (
            <button
              disabled={transitioning}
              onClick={() => setShowReasonModal(true)}
              className="btn btn-secondary"
              style={{ color: 'var(--color-danger)' }}
            >
              Close / Not Converted
            </button>
          )}

          {lead.convertedClientId && (
            <Link to={`/clients/${lead.convertedClientId}`} className="btn btn-primary">
              View Retained Client File &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Grid: Overview & Activities */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(450px, 2fr)', gap: '1.5rem' }}>
        
        {/* Left Column: Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Inquiry Details
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Prospective Party / Contact</span>
                <Link to={`/contacts/${lead.contact?.id}`} style={{ fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
                  {lead.contact?.displayName}
                </Link>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Phone & Email</span>
                <div>{lead.contact?.phone || '—'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{lead.contact?.email || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Inquiry Source</span>
                <strong>{lead.source}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Assigned Advocate</span>
                <strong>{lead.assignedTo?.name || 'Unassigned'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Matter Synopsis</span>
                <p style={{ marginTop: '0.25rem', color: 'var(--color-secondary)', whiteSpace: 'pre-wrap' }}>{lead.notes || 'No synopsis provided.'}</p>
              </div>
              {lead.notConvertedReason && (
                <div style={{ backgroundColor: '#fee2e2', padding: '0.75rem', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                  <span style={{ color: 'var(--color-danger)', fontWeight: 600, display: 'block', fontSize: '0.8rem' }}>Non-Conversion Reason</span>
                  <div style={{ color: '#7f1d1d', fontSize: '0.85rem' }}>{lead.notConvertedReason}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction Log & Log Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Add Activity Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Log Communication / Activity Note</h3>
            <form onSubmit={handleAddActivity} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '0.75rem' }}>
                <select
                  value={activityData.activity_type}
                  onChange={(e) => setActivityData({ ...activityData, activity_type: e.target.value })}
                  style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="CALL">Call</option>
                  <option value="MESSAGE">WhatsApp/SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="MEETING">Meeting</option>
                  <option value="NOTE">Chambers Note</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Subject / Discussion topic..."
                  value={activityData.subject}
                  onChange={(e) => setActivityData({ ...activityData, subject: e.target.value })}
                  style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <textarea
                rows="2"
                placeholder="Details of inquiry discussion, fee estimate discussed, counsel advice..."
                value={activityData.description}
                onChange={(e) => setActivityData({ ...activityData, description: e.target.value })}
                style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={submittingAct} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                  {submittingAct ? 'Logging...' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>

          {/* Activity Log List */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Inquiry Activity History
            </h3>

            {(!lead.activities || lead.activities.length === 0) ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                No activities logged for this inquiry yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {lead.activities.map((act) => (
                  <div key={act.id} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge" style={{ fontSize: '0.7rem' }}>{act.activityType}</span>
                        <strong style={{ fontSize: '0.85rem' }}>{act.subject}</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {new Date(act.activityDate).toLocaleString()}
                      </span>
                    </div>
                    {act.description && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                        {act.description}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.35rem' }}>
                      Logged by: {act.createdByName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Non-conversion Reason Modal */}
      {showReasonModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>Close Lead (Not Converted)</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Please record the reason why this matter did not proceed to formal retention (e.g. Conflict of interest, fee mismatch, client chose outside counsel, lack of jurisdiction).
            </p>
            <form onSubmit={handleConfirmNotConverted} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason for Non-Conversion</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conflict of interest with existing client"
                  value={notConvertedReason}
                  onChange={(e) => setNotConvertedReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowReasonModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                  Confirm Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadDetail;
