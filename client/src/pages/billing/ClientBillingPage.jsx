import React, { useState, useEffect } from 'react';
import clientBillingService from '../../services/clientBillingService';
import InvoiceStatusBadge from '../../components/billing/InvoiceStatusBadge';
import { IconInvoice, IconPayment, IconDownload } from '../../components/common/Icons';

export const ClientBillingPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'payments'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchClientBilling();
  }, []);

  const fetchClientBilling = async () => {
    try {
      setLoading(true);
      const [dashRes, invRes, payRes] = await Promise.all([
        clientBillingService.getDashboard(),
        clientBillingService.getInvoices(),
        clientBillingService.getPayments()
      ]);
      setDashboard(dashRes.data || {});
      setInvoices(invRes.data?.items || (Array.isArray(invRes.data) ? invRes.data : []));
      setPayments(payRes.data?.items || (Array.isArray(payRes.data) ? payRes.data : []));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load client billing details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (inv) => {
    try {
      setDownloadingId(`inv-${inv.id}`);
      await clientBillingService.downloadInvoicePdf(inv.id, inv.invoice_number);
    } catch (err) {
      alert('Failed to download invoice: ' + (err.message || 'Error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadReceipt = async (p) => {
    try {
      setDownloadingId(`pay-${p.id}`);
      await clientBillingService.downloadReceiptPdf(p.id, p.payment_number);
    } catch (err) {
      alert('Failed to download receipt: ' + (err.message || 'Error'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading your billing details...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{
          backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '16px', color: '#b91c1c'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Client Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
          My Invoices & Payment Receipts
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
          Review Chambers fee notes, track paid disbursements, and download official receipts.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px', marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>OUTSTANDING DUE</div>
          <div style={{
            fontSize: '1.75rem', fontWeight: '800', marginTop: '4px',
            color: (dashboard?.totalOutstanding || 0) > 0 ? '#b91c1c' : '#059669'
          }}>
            ₹{(dashboard?.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            Payable to Chambers
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>TOTAL PAID</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
            ₹{(dashboard?.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            Cleared receipts
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>TOTAL INVOICES</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {dashboard?.totalInvoices || invoices.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            Issued fee notes
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          style={{
            padding: '10px 20px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer',
            background: 'none', border: 'none',
            borderBottom: activeTab === 'invoices' ? '2px solid #0f172a' : '2px solid transparent',
            color: activeTab === 'invoices' ? '#0f172a' : '#64748b'
          }}
        >
          Invoices & Bills ({invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          style={{
            padding: '10px 20px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer',
            background: 'none', border: 'none',
            borderBottom: activeTab === 'payments' ? '2px solid #0f172a' : '2px solid transparent',
            color: activeTab === 'payments' ? '#0f172a' : '#64748b'
          }}
        >
          Payment Receipts ({payments.length})
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
        }}>
          {invoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No invoices have been issued for your account yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Invoice #</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Matter</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Due Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Due (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                        {inv.invoice_number}
                        {inv.rcm_applicable ? (
                          <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: '600' }}>
                            RCM (0% GST)
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#334155' }}>
                        {inv.case_title ? (
                          <div>{inv.case_number ? `${inv.case_number} - ` : ''}{inv.case_title}</div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>General Counsel</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                        {inv.due_date}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        ₹{parseFloat(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700' }}>
                        <span style={{ color: parseFloat(inv.amount_due) > 0 ? '#b91c1c' : '#059669' }}>
                          ₹{parseFloat(inv.amount_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <InvoiceStatusBadge status={inv.status} />
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(inv)}
                          disabled={downloadingId === `inv-${inv.id}`}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.8rem',
                            fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <IconDownload size={14} />
                          {downloadingId === `inv-${inv.id}` ? 'Saving...' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Receipts */}
      {activeTab === 'payments' && (
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
        }}>
          {payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No payments recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Receipt #</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Invoice #</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Payment Mode</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Amount Paid (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Official Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                        {p.payment_number}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#475569', fontSize: '0.85rem' }}>
                        {p.payment_date}
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: '600', color: '#2563eb' }}>
                        {p.invoice_number}
                      </td>

                      <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9',
                          fontWeight: '600', color: '#334155'
                        }}>
                          {p.payment_mode}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                        ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(p)}
                          disabled={downloadingId === `pay-${p.id}`}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.8rem',
                            fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <IconDownload size={14} />
                          {downloadingId === `pay-${p.id}` ? 'Saving...' : 'Receipt PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientBillingPage;
