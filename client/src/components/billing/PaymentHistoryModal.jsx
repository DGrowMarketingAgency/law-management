import React, { useState } from 'react';
import paymentService from '../../services/paymentService';
import { IconReceipt, IconDownload } from '../common/Icons';

export const PaymentHistoryModal = ({ invoice, payments = [], onClose, onRefundSuccess }) => {
  const [refundingId, setRefundingId] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);

  const handleDownloadReceipt = async (payment) => {
    try {
      setDownloadingId(payment.id);
      await paymentService.downloadReceiptPdf(payment.id, payment.payment_number);
    } catch (err) {
      alert('Failed to download receipt: ' + (err.message || 'Error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleProcessRefund = async (paymentId) => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      setError('Please enter a valid refund amount.');
      return;
    }
    try {
      setError(null);
      await paymentService.refundPayment(paymentId, {
        amount: parseFloat(refundAmount),
        reason: refundReason
      });
      setRefundingId(null);
      setRefundReason('');
      setRefundAmount('');
      if (onRefundSuccess) onRefundSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Refund failed');
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px'
    }}>
      <div className="modal-content" style={{
        background: '#ffffff', borderRadius: '12px', maxWidth: '650px', width: '100%',
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
              Payment Receipts & History
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Invoice {invoice.invoice_number} • Total Paid: <strong>₹{parseFloat(invoice.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
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

        {/* List Body */}
        <div style={{ padding: '24px', maxHeight: '450px', overflowY: 'auto' }}>
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2',
              color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.875rem', marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
              <IconReceipt size={36} color="#94a3b8" />
              <p style={{ marginTop: '8px', fontSize: '0.95rem' }}>No payments have been recorded for this invoice yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {payments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>
                        {p.payment_number}
                      </span>
                      <span style={{
                        fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px',
                        backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600'
                      }}>
                        {p.payment_mode}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      Date: {p.payment_date} {p.reference_number && `• Ref: ${p.reference_number}`}
                    </div>
                    {p.notes && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px', fontStyle: 'italic' }}>
                        "{p.notes}"
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#059669' }}>
                        ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(p)}
                      disabled={downloadingId === p.id}
                      style={{
                        padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
                        backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.8rem',
                        fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                      title="Download Official Chambers Receipt PDF"
                    >
                      <IconDownload size={14} />
                      {downloadingId === p.id ? 'Saving...' : 'Receipt'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex',
          justifyContent: 'flex-end', backgroundColor: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px', border: '1px solid #cbd5e1', borderRadius: '6px',
              backgroundColor: '#ffffff', color: '#334155', fontSize: '0.875rem',
              fontWeight: '600', cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;
