import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import clientService from '../services/clientService';

const ClientDetail = () => {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Record Consent Modal
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentData, setConsentData] = useState({
    consent_type: 'DATA_PROCESSING',
    consent_text: 'I consent to the chambers processing personal information and case documents for legal representation.',
    consent_version: 'v1.0',
  });
  const [submittingConsent, setSubmittingConsent] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [id]);

  const fetchClient = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await clientService.getClientById(id);
      setClient(res.data.client);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Change client status to ${newStatus}?`)) return;
    try {
      await clientService.updateStatus(id, newStatus);
      fetchClient();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleRecordConsent = async (e) => {
    e.preventDefault();
    try {
      setSubmittingConsent(true);
      await clientService.recordConsent(id, consentData);
      setShowConsentModal(false);
      fetchClient();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record consent');
    } finally {
      setSubmittingConsent(false);
    }
  };

  const handleWithdrawConsent = async (consentId) => {
    if (!window.confirm('Withdraw this consent? An immutable withdrawal timestamp will be permanently logged.')) return;
    try {
      await clientService.withdrawConsent(id, consentId);
      fetchClient();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to withdraw consent');
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading Client File...</div>;
  }

  if (error || !client) {
    return <div className="alert alert-danger">{error || 'Client not found'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
            <Link to="/clients" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>&larr; Back to Clients Directory</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {client.clientCode} &bull; {client.contact?.displayName}
            </h1>
            <span className="badge" style={{
              backgroundColor: client.status === 'ACTIVE' ? 'var(--color-success-bg)' : '#fee2e2',
              color: client.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
              {client.status}
            </span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Client Onboarded: {new Date(client.createdAt).toLocaleDateString()} &bull; Source: {client.clientSource}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={client.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <Link to={`/contacts/${client.contact?.id}`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            View Contact 360°
          </Link>
          <button onClick={() => setShowConsentModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            + Record Consent
          </button>
        </div>
      </div>

      {/* Grid: Overview & Consents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(450px, 2fr)', gap: '1.5rem' }}>
        
        {/* Left Column: Client Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Client Information
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Chambers Client ID</span>
                <strong style={{ color: 'var(--color-accent)' }}>{client.clientCode}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Contact Name</span>
                <strong>{client.contact?.displayName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Phone</span>
                <strong>{client.contact?.phone || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Email</span>
                <strong>{client.contact?.email || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Organization</span>
                <strong>{client.contact?.organizationName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Retention Notes</span>
                <p style={{ marginTop: '0.25rem', color: 'var(--color-secondary)' }}>{client.notes || 'No retention notes recorded.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Immutable Client Consents (Compliance) */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Consent & Compliance Registry</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Immutable historical consent records with audit timestamps and withdrawal governance.
              </p>
            </div>
            <button onClick={() => setShowConsentModal(true)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
              + Add Consent
            </button>
          </div>

          {(!client.consents || client.consents.length === 0) ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              No consents recorded yet. Please ensure data processing and communication consents are on file.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {client.consents.map((cs) => (
                <div key={cs.id} style={{
                  padding: '1rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: cs.withdrawnAt ? '#fef2f2' : 'var(--color-bg-subtle)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge" style={{ backgroundColor: cs.withdrawnAt ? '#fee2e2' : 'var(--color-success-bg)', color: cs.withdrawnAt ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {cs.consentType} ({cs.consentVersion})
                      </span>
                      {cs.withdrawnAt ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>WITHDRAWN</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>ACTIVE</span>
                      )}
                    </div>
                    {!cs.withdrawnAt && (
                      <button
                        onClick={() => handleWithdrawConsent(cs.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                      >
                        Withdraw Consent
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', fontStyle: 'italic', marginBottom: '0.4rem' }}>
                    "{cs.consentText}"
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Consented On: {new Date(cs.consentedAt).toLocaleString()} &bull; Recorded By: {cs.recordedByName}
                    {cs.withdrawnAt && (
                      <div style={{ color: 'var(--color-danger)', marginTop: '0.2rem' }}>
                        Withdrawn On: {new Date(cs.withdrawnAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Record Consent Modal */}
      {showConsentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Record Client Consent</h2>
              <button onClick={() => setShowConsentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleRecordConsent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Consent Category</label>
                <select
                  value={consentData.consent_type}
                  onChange={(e) => setConsentData({ ...consentData, consent_type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="DATA_PROCESSING">Data Processing (General)</option>
                  <option value="COMMUNICATION">Case Communication & Updates</option>
                  <option value="WHATSAPP">WhatsApp Messaging & Urgent Alerts</option>
                  <option value="DOCUMENT_SHARING">Third-Party Document Sharing (Briefing)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Policy / Version</label>
                <input
                  type="text"
                  value={consentData.consent_version}
                  onChange={(e) => setConsentData({ ...consentData, consent_version: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Consent Verbatim Text</label>
                <textarea
                  rows="3"
                  required
                  value={consentData.consent_text}
                  onChange={(e) => setConsentData({ ...consentData, consent_text: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowConsentModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submittingConsent} className="btn btn-primary">
                  {submittingConsent ? 'Recording Immutable Audit...' : 'Save Consent Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetail;
