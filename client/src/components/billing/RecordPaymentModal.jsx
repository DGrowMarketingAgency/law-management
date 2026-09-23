import React, { useState } from 'react';
import paymentService from '../../services/paymentService';

export const RecordPaymentModal = ({ invoice, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: invoice.amount_due || '',
    payment_mode: 'NEFT',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const maxAmount = parseFloat(invoice.amount_due) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payAmount = parseFloat(formData.amount);
    if (!payAmount || payAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (payAmount > maxAmount + 0.001) {
      setError(`Payment amount cannot exceed outstanding balance of ₹${maxAmount.toFixed(2)}.`);
      return;
    }

    try {
      setLoading(true);
      const res = await paymentService.recordPayment({
        invoice_id: invoice.id,
        amount: payAmount,
        payment_mode: formData.payment_mode,
        payment_date: formData.payment_date,
        reference_number: formData.reference_number || undefined,
        notes: formData.notes || undefined
      });

      if (onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record payment');
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
        background: '#ffffff', borderRadius: '12px', maxWidth: '500px', width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
              Record Payment
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Invoice {invoice.invoice_number} • Outstanding: <strong>₹{maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Payment Amount (INR ₹) *
            </label>
            <input
              type="number"
              step="0.01"
              max={maxAmount}
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '1rem', fontWeight: '600', color: '#0f172a'
              }}
              placeholder={`Max ₹${maxAmount.toFixed(2)}`}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, amount: maxAmount.toFixed(2) })}
                style={{
                  background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem',
                  fontWeight: '600', cursor: 'pointer', padding: 0
                }}
              >
                Pay Full Balance (₹{maxAmount.toFixed(2)})
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Payment Mode *
              </label>
              <select
                value={formData.payment_mode}
                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                }}
              >
                <option value="NEFT">NEFT Transfer</option>
                <option value="RTGS">RTGS Transfer</option>
                <option value="IMPS">IMPS</option>
                <option value="UPI">UPI / QR</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                <option value="CASH">Cash Deposit</option>
                <option value="RETAINER_ADJUSTMENT">Retainer Adjustment</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Bank UTR / Cheque / Transaction Ref #
            </label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '0.9rem', color: '#0f172a'
              }}
              placeholder="e.g. UTR12938471923, CHQ# 839201"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Internal Notes / Narrative
            </label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                fontSize: '0.9rem', color: '#0f172a', resize: 'vertical'
              }}
              placeholder="Received via client HDFC bank account..."
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
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {loading ? 'Recording...' : 'Confirm Payment & Generate Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal;
