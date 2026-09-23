import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import caseService from '../../services/caseService';
import courtService from '../../services/courtService';
import clientService from '../../services/clientService';
import userService from '../../services/userService';

const CaseCreatePage = () => {
  const navigate = useNavigate();

  const [courts, setCourts] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    case_number: '',
    cnr_number: '',
    court_id: '',
    case_type: 'CIVIL_SUIT',
    case_stage: 'NEW',
    case_status: 'ACTIVE',
    title: '',
    filing_date: new Date().toISOString().slice(0, 10),
    registration_date: '',
    description: '',
    primary_client_id: '',
    assigned_user_ids: [],
  });

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoadingLookups(true);
      const [courtRes, clientRes, userRes] = await Promise.all([
        courtService.getCourts({ limit: 100, is_active: true }),
        clientService.getClients({ limit: 100 }),
        userService.getUsers({ limit: 100 }),
      ]);
      setCourts(courtRes.data.items || []);
      setClients(clientRes.data.items || []);
      setUsers(userRes.data?.users || []);
    } catch (err) {
      setError('Failed to load courts or clients for case creation.');
    } finally {
      setLoadingLookups(false);
    }
  };

  const handleUserToggle = (uid) => {
    const current = [...formData.assigned_user_ids];
    const index = current.indexOf(uid);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(uid);
    }
    setFormData({ ...formData, assigned_user_ids: current });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.court_id || !formData.primary_client_id) {
      setError('Please select both a Court and a Primary Client.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await caseService.createCase(formData);
      alert('Case opened successfully!');
      navigate(`/cases/${res.data.case.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open case file.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLookups) {
    return <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading Chambers Setup Data...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
          <Link to="/cases" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>&larr; Back to Case Docket</Link>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Open New Court Case File</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Initialize court matter record with sequential verification, court jurisdiction, and initial advocate team.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Section 1: Basic Case Data */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            1. Matter Title & Identifiers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Case Title (Cause Title)</label>
              <input
                type="text"
                required
                placeholder="e.g. Anand Kumar vs State of NCT of Delhi"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Case Number / Filing No.</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS(COMM) 234/2026"
                  value={formData.case_number}
                  onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>CNR Number (16 Digits, Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. DLDL010023452026"
                  value={formData.cnr_number}
                  onChange={(e) => setFormData({ ...formData, cnr_number: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Must be strictly unique if provided.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Case Type</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WRIT_PETITION or CIVIL_SUIT"
                  value={formData.case_type}
                  onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Case Stage</label>
                <select
                  value={formData.case_stage}
                  onChange={(e) => setFormData({ ...formData, case_stage: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="NEW">New</option>
                  <option value="FILED">Filed</option>
                  <option value="ADMITTED">Admitted</option>
                  <option value="NOTICE">Notice Issued</option>
                  <option value="PLEADINGS">Pleadings / Written Statement</option>
                  <option value="EVIDENCE">Evidence</option>
                  <option value="ARGUMENTS">Final Arguments</option>
                  <option value="JUDGMENT">Reserved for Judgment</option>
                  <option value="APPEAL">Appeal</option>
                  <option value="EXECUTION">Execution</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
                <select
                  value={formData.case_status}
                  onChange={(e) => setFormData({ ...formData, case_status: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="STAYED">Stayed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Court & Client Selection */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            2. Forum & Client Representation
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Court / Bench</label>
              <select
                required
                value={formData.court_id}
                onChange={(e) => setFormData({ ...formData, court_id: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="">-- Choose Court from Registry --</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Primary Retained Client</label>
              <select
                required
                value={formData.primary_client_id}
                onChange={(e) => setFormData({ ...formData, primary_client_id: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="">-- Choose Retained Client --</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.contact?.displayName} ({cl.clientCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Key Dates */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            3. Filing & Registration Dates
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Filing Date</label>
              <input
                type="date"
                value={formData.filing_date}
                onChange={(e) => setFormData({ ...formData, filing_date: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Registration / Numbering Date</label>
              <input
                type="date"
                value={formData.registration_date}
                onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Initial Advocate Assignments */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            4. Assigned Chambers Legal Team
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {users.map((u) => (
              <label
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: formData.assigned_user_ids.includes(u.id) ? 'var(--color-bg-subtle)' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.assigned_user_ids.includes(u.id)}
                  onChange={() => handleUserToggle(u.id)}
                />
                <span style={{ fontSize: '0.85rem' }}>
                  {u.firstName} {u.lastName} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>({u.roles?.[0] || 'User'})</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Section 5: Matter Synopsis */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Brief Synopsis & Prayer</label>
          <textarea
            rows="3"
            placeholder="Key facts, legal prayer, interim relief claimed..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={() => navigate('/cases')} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Creating Case Record...' : 'Open Case File'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default CaseCreatePage;
