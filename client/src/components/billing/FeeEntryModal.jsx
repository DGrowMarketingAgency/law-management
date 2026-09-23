import React, { useState, useEffect } from 'react';
import feeEntryService from '../../services/feeEntryService';
import clientService from '../../services/clientService';
import caseService from '../../services/caseService';

export const FeeEntryModal = ({ feeEntry, onClose, onSuccess }) => {
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEdit = Boolean(feeEntry && feeEntry.id);

  const [formData, setFormData] = useState({
    client_id: feeEntry?.client_id || '',
    case_id: feeEntry?.case_id || '',
    entry_type: feeEntry?.entry_type || 'TIME',
    date: feeEntry?.date ? feeEntry.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    description: feeEntry?.description || '',
    duration_minutes: feeEntry?.duration_minutes || 60,
    rate: feeEntry?.rate || 3500,
    amount: feeEntry?.amount || 3500,
    hearing_id: feeEntry?.hearing_id || ''
  });

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const clientRes = await clientService.getClients({ limit: 100 });
      const rawClients = clientRes.data?.items || (Array.isArray(clientRes.data) ? clientRes.data : []);
      setClients(rawClients.map(c => ({
        id: c.id,
        display_name: c.contact?.displayName || c.display_name || c.clientCode || `Client #${c.id}`,
        client_type: c.contact?.contactType || c.client_type || 'INDIVIDUAL'
      })));

      const caseRes = await caseService.getCases({ limit: 100 });
      const rawCases = caseRes.data?.items || (Array.isArray(caseRes.data) ? caseRes.data : []);
      setCases(rawCases.map(cs => ({
        id: cs.id,
        title: cs.title,
        case_number: cs.caseNumber || cs.case_number || ''
      })));
    } catch (err) {
      console.error('Failed to load clients/cases:', err);
    }
  };

  // Auto-calculate amount when duration/rate or type changes
  const handleTypeChange = (type) => {
    let newRate = formData.rate;
    let newDuration = formData.duration_minutes;
    let newAmount = formData.amount;

    if (type === 'TIME') {
      newRate = newRate || 3500;
      newDuration = newDuration || 60;
      newAmount = ((newDuration / 60) * newRate).toFixed(2);
    } else if (type === 'APPEARANCE') {
      newAmount = newRate || 15000;
    } else if (type === 'FIXED_FEE') {
      newAmount = newAmount || 25000;
    } else if (type === 'EXPENSE') {
      newAmount = newAmount || 1500;
    }

    setFormData({
      ...formData,
      entry_type: type,
      rate: newRate,
      duration_minutes: newDuration,
      amount: newAmount
    });
  };

  const handleDurationOrRateChange = (duration, rate) => {
    const mins = parseInt(duration, 10) || 0;
    const r = parseFloat(rate) || 0;
    const computed = ((mins / 60) * r).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      duration_minutes: duration,
      rate,
      amount: computed
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.client_id) {
      setError('Please select a client.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Please provide a description of the legal service.');
      return;
    }
    if (!parseFloat(formData.amount) || parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        client_id: parseInt(formData.client_id, 10),
        case_id: formData.case_id ? parseInt(formData.case_id, 10) : null,
        entry_type: formData.entry_type,
        date: formData.date,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        duration_minutes: formData.entry_type === 'TIME' ? parseInt(formData.duration_minutes, 10) : null,
        rate: ['TIME', 'APPEARANCE'].includes(formData.entry_type) ? parseFloat(formData.rate) : null,
        hearing_id: formData.hearing_id ? parseInt(formData.hearing_id, 10) : null
      };

      if (isEdit) {
        await feeEntryService.updateFeeEntry(feeEntry.id, payload);
      } else {
        await feeEntryService.createFeeEntry(payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save fee entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px'
    }}>
      <div className="modal-content" style={{
        background: '#ffffff', borderRadius: '12px', maxWidth: '550px', width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
              {isEdit ? 'Edit Fee Entry' : 'Log Billable Service / Fee Entry'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Track billable counsel time, court appearances, and practice expenses.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer',
              color: '#94a3b8', lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2',
              color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.875rem', marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {/* Type Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Fee Type *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { id: 'TIME', label: 'Time Based' },
                { id: 'APPEARANCE', label: 'Court Appearance' },
                { id: 'FIXED_FEE', label: 'Fixed Fee' },
                { id: 'EXPENSE', label: 'Expense / Outlay' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  style={{
                    padding: '8px 4px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600',
                    textAlign: 'center', cursor: 'pointer', border: '1px solid',
                    backgroundColor: formData.entry_type === t.id ? '#0f172a' : '#f8fafc',
                    color: formData.entry_type === t.id ? '#ffffff' : '#475569',
                    borderColor: formData.entry_type === t.id ? '#0f172a' : '#cbd5e1'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client & Case */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Client *
              </label>
              <select
                required
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                }}
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name} {c.client_type === 'CORPORATE' ? '(Corporate)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Matter / Case (Optional)
              </label>
              <select
                value={formData.case_id}
                onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                }}
              >
                <option value="">-- General Chambers Counsel --</option>
                {cases.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.case_number ? `${cs.case_number} - ` : ''}{cs.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Dynamic Calc */}
          <div style={{ display: 'grid', gridTemplateColumns: formData.entry_type === 'TIME' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Service Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a'
                }}
              />
            </div>

            {formData.entry_type === 'TIME' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Duration (Mins) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="5"
                  required
                  value={formData.duration_minutes}
                  onChange={(e) => handleDurationOrRateChange(e.target.value, formData.rate)}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#0f172a'
                  }}
                />
              </div>
            )}

            {formData.entry_type === 'TIME' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Hourly Rate (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={formData.rate}
                  onChange={(e) => handleDurationOrRateChange(formData.duration_minutes, e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#0f172a'
                  }}
                />
              </div>
            )}

            {formData.entry_type !== 'TIME' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Total Fee (INR ₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.95rem', fontWeight: '700', color: '#0f172a'
                  }}
                />
              </div>
            )}
          </div>

          {formData.entry_type === 'TIME' && (
            <div style={{
              backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'
            }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Calculated Fee: ({(formData.duration_minutes / 60).toFixed(2)} hrs @ ₹{formData.rate}/hr)
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                ₹{parseFloat(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Service Narrative / Item Description *
            </label>
            <textarea
              rows="3"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '0.9rem', color: '#0f172a', resize: 'vertical'
              }}
              placeholder="e.g. Legal research on limitation under Section 5, drafting of special leave petition..."
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: '8px',
                backgroundColor: '#ffffff', color: '#475569', fontSize: '0.9rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px', border: 'none', borderRadius: '8px',
                backgroundColor: '#0f172a', color: '#ffffff', fontSize: '0.9rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              {loading ? 'Saving...' : isEdit ? 'Update Entry' : 'Log Fee Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeeEntryModal;
