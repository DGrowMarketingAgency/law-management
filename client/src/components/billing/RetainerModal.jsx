import React, { useState, useEffect } from 'react';
import retainerService from '../../services/retainerService';
import clientService from '../../services/clientService';
import caseService from '../../services/caseService';

export const RetainerModal = ({ mode = 'CREATE', retainer = null, onClose, onSuccess }) => {
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // modes: 'CREATE' | 'DEPOSIT' | 'REFUND'
  const [formData, setFormData] = useState({
    client_id: retainer?.client_id || '',
    case_id: retainer?.case_id || '',
    amount: '',
    payment_mode: 'NEFT',
    reference_number: '',
    notes: '',
    reason: ''
  });

  useEffect(() => {
    if (mode === 'CREATE') {
      fetchDropdowns();
    }
  }, [mode]);

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

  const maxRefund = parseFloat(retainer?.current_balance || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(formData.amount);
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    try {
      setLoading(true);

      if (mode === 'CREATE') {
        if (!formData.client_id) {
          setError('Please select a client.');
          setLoading(false);
          return;
        }
        await retainerService.createRetainer({
          client_id: parseInt(formData.client_id, 10),
          case_id: formData.case_id ? parseInt(formData.case_id, 10) : null,
          initial_deposit: amt,
          payment_mode: formData.payment_mode,
          reference_number: formData.reference_number || undefined,
          notes: formData.notes || undefined
        });
      } else if (mode === 'DEPOSIT') {
        await retainerService.depositFunds(retainer.id, {
          amount: amt,
          payment_mode: formData.payment_mode,
          reference_number: formData.reference_number || undefined,
          notes: formData.notes || undefined
        });
      } else if (mode === 'REFUND') {
        if (amt > maxRefund + 0.001) {
          setError(`Refund amount cannot exceed current retainer balance of ₹${maxRefund.toFixed(2)}.`);
          setLoading(false);
          return;
        }
        await retainerService.refundFunds(retainer.id, {
          amount: amt,
          reason: formData.reason || undefined,
          payment_mode: formData.payment_mode,
          reference_number: formData.reference_number || undefined
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'DEPOSIT') return `Deposit Retainer Funds (${retainer?.account_number})`;
    if (mode === 'REFUND') return `Refund Retainer Balance (${retainer?.account_number})`;
    return 'Open Client Retainer Trust Account';
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px'
    }}>
      <div className="modal-content" style={{
        background: '#ffffff', borderRadius: '12px', maxWidth: '520px', width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
              {getTitle()}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              {mode === 'REFUND'
                ? `Current available balance: ₹${maxRefund.toFixed(2)}`
                : 'Fiduciary advance legal deposit held in trust.'}
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

          {mode === 'CREATE' && (
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
                      {c.display_name}
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
                  <option value="">-- General Retainer --</option>
                  {cases.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.case_number ? `${cs.case_number} - ` : ''}{cs.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                {mode === 'REFUND' ? 'Refund Amount (₹) *' : 'Deposit Amount (₹) *'}
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={mode === 'REFUND' ? maxRefund : undefined}
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '1rem', fontWeight: '700', color: '#0f172a'
                }}
                placeholder={mode === 'REFUND' ? `Max ₹${maxRefund.toFixed(2)}` : 'e.g. 50000'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Payment Mode *
              </label>
              <select
                value={formData.payment_mode}
                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                }}
              >
                <option value="NEFT">NEFT Transfer</option>
                <option value="RTGS">RTGS Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEMAND_DRAFT">Demand Draft</option>
                <option value="CASH">Cash Deposit</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Transaction Reference / UTR #
            </label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '0.9rem', color: '#0f172a'
              }}
              placeholder="e.g. UTR-982347102"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              {mode === 'REFUND' ? 'Reason for Refund *' : 'Trust Notes / Description'}
            </label>
            <textarea
              rows="2"
              required={mode === 'REFUND'}
              value={mode === 'REFUND' ? formData.reason : formData.notes}
              onChange={(e) => {
                if (mode === 'REFUND') setFormData({ ...formData, reason: e.target.value });
                else setFormData({ ...formData, notes: e.target.value });
              }}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '0.9rem', color: '#0f172a', resize: 'vertical'
              }}
              placeholder={mode === 'REFUND' ? 'Matter concluded, surplus funds refunded to client...' : 'Advance security retainer for upcoming trial proceedings...'}
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
                backgroundColor: mode === 'REFUND' ? '#dc2626' : '#0f172a',
                color: '#ffffff', fontSize: '0.9rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              {loading
                ? 'Processing...'
                : mode === 'REFUND'
                ? 'Process Refund'
                : mode === 'DEPOSIT'
                ? 'Add Deposit'
                : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RetainerModal;
