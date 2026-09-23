import React, { useState, useEffect } from 'react';
import retainerService from '../../services/retainerService';
import RetainerModal from '../../components/billing/RetainerModal';
import { IconRetainer } from '../../components/common/Icons';

export const RetainersPage = () => {
  const [retainers, setRetainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [modalState, setModalState] = useState({ open: false, mode: 'CREATE', retainer: null });
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    fetchRetainers();
  }, []);

  const fetchRetainers = async () => {
    try {
      setLoading(true);
      const res = await retainerService.getRetainers();
      setRetainers(res.data?.items || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load retainers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLedger = async (retainer) => {
    try {
      setLoadingLedger(true);
      const res = await retainerService.getRetainerById(retainer.id);
      setSelectedLedger(res.data);
    } catch (err) {
      alert('Failed to load transaction ledger: ' + (err.message || 'Error'));
    } finally {
      setLoadingLedger(false);
    }
  };

  const totalRetainersBalance = retainers.reduce((sum, r) => sum + (parseFloat(r.current_balance) || 0), 0);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: '16px', marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
            Client Retainers & Advance Trust Accounts
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Manage fiduciary client security advances, transparent drawdowns against fee bills, and refunds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalState({ open: true, mode: 'CREATE', retainer: null })}
          style={{
            padding: '10px 20px', borderRadius: '8px', backgroundColor: '#0f172a',
            color: '#ffffff', fontWeight: '600', fontSize: '0.9rem', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          + Open Retainer Account
        </button>
      </div>

      {/* Trust Balance KPI Card */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>
            TOTAL CLIENT FUNDS IN TRUST
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#7c3aed', marginTop: '4px' }}>
            ₹{totalRetainersBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
            Held securely across {retainers.length} active client accounts
          </div>
        </div>
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
          <IconRetainer size={28} />
        </div>
      </div>

      {/* Retainers Table */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading retainer accounts...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#b91c1c' }}>{error}</div>
        ) : retainers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: '600', color: '#334155' }}>
              No retainer accounts established
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Open a retainer account for corporate or private clients using the button above.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Account #</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Client</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Matter</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Deposited (₹)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Available Balance (₹)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {retainers.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                      {r.account_number}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{r.client_name}</div>
                      {r.client_company && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.client_company}</div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {r.case_title ? (
                        <div>{r.case_number ? `${r.case_number} - ` : ''}{r.case_title}</div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>General Chambers</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#475569' }}>
                      ₹{parseFloat(r.total_deposited).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#7c3aed' }}>
                      ₹{parseFloat(r.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: r.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                        color: r.status === 'ACTIVE' ? '#065f46' : '#64748b'
                      }}>
                        {r.status}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenLedger(r)}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff', color: '#334155', fontSize: '0.8rem',
                            fontWeight: '600', cursor: 'pointer'
                          }}
                        >
                          Ledger
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalState({ open: true, mode: 'DEPOSIT', retainer: r })}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', border: 'none',
                            backgroundColor: '#0f172a', color: '#ffffff', fontSize: '0.8rem',
                            fontWeight: '600', cursor: 'pointer'
                          }}
                        >
                          + Deposit
                        </button>

                        {parseFloat(r.current_balance) > 0 && (
                          <button
                            type="button"
                            onClick={() => setModalState({ open: true, mode: 'REFUND', retainer: r })}
                            style={{
                              padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca',
                              backgroundColor: '#fff1f2', color: '#b91c1c', fontSize: '0.8rem',
                              fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Ledger Drawer / Modal */}
      {selectedLedger && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', maxWidth: '700px', width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
                  Retainer Ledger: {selectedLedger.account_number}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Client: <strong>{selectedLedger.client_name}</strong> • Current Balance: <strong style={{ color: '#7c3aed' }}>₹{parseFloat(selectedLedger.current_balance).toFixed(2)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedger(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '24px', maxHeight: '450px', overflowY: 'auto' }}>
              {(!selectedLedger.transactions || selectedLedger.transactions.length === 0) ? (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>No transactions recorded.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Type</th>
                      <th style={{ padding: '8px' }}>Description / Ref</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLedger.transactions.map((t) => {
                      const isCredit = ['DEPOSIT', 'ADJUSTMENT'].includes(t.transaction_type);
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 8px', color: '#64748b' }}>
                            {t.created_at ? t.created_at.slice(0, 10) : ''}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{
                              fontWeight: '700', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                              backgroundColor: isCredit ? '#ecfdf5' : '#fef2f2',
                              color: isCredit ? '#065f46' : '#b91c1c'
                            }}>
                              {t.transaction_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', color: '#0f172a' }}>
                            <div>{t.description || t.transaction_type}</div>
                            {t.reference_number && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ref: {t.reference_number}</div>
                            )}
                          </td>
                          <td style={{
                            padding: '10px 8px', textAlign: 'right', fontWeight: '700',
                            color: isCredit ? '#059669' : '#dc2626'
                          }}>
                            {isCredit ? '+' : '-'}₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                            ₹{parseFloat(t.balance_after).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{
              padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex',
              justifyContent: 'flex-end', backgroundColor: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setSelectedLedger(null)}
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
      )}

      {/* Retainer Modal (Create / Deposit / Refund) */}
      {modalState.open && (
        <RetainerModal
          mode={modalState.mode}
          retainer={modalState.retainer}
          onClose={() => setModalState({ open: false, mode: 'CREATE', retainer: null })}
          onSuccess={() => {
            fetchRetainers();
          }}
        />
      )}
    </div>
  );
};

export default RetainersPage;
