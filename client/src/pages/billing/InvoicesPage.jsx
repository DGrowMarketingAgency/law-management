import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import invoiceService from '../../services/invoiceService';
import InvoiceStatusBadge from '../../components/billing/InvoiceStatusBadge';
import RecordPaymentModal from '../../components/billing/RecordPaymentModal';
import PaymentHistoryModal from '../../components/billing/PaymentHistoryModal';
import { IconDownload, IconPayment, IconReceipt } from '../../components/common/Icons';

export const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [historyInvoice, setHistoryInvoice] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await invoiceService.getInvoices(params);
      setInvoices(res.data?.items || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (invoice) => {
    try {
      setDownloadingId(invoice.id);
      await invoiceService.downloadPdf(invoice.id, invoice.invoice_number);
    } catch (err) {
      alert('Failed to download invoice PDF: ' + (err.message || 'Error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleIssueInvoice = async (id) => {
    if (!window.confirm('Issue this invoice? An official immutable invoice number and snapshot will be generated.')) {
      return;
    }
    try {
      await invoiceService.issueInvoice(id);
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to issue invoice');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.client_name?.toLowerCase().includes(q) ||
      inv.case_title?.toLowerCase().includes(q) ||
      inv.case_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: '16px', marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
            Invoices & Chambers Fee Notes
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Generate tax compliant bills, track partial collections, issue formal receipts, and manage status lifecycles.
          </p>
        </div>

        <Link
          to="/invoices/new"
          style={{
            padding: '10px 20px', borderRadius: '8px', backgroundColor: '#0f172a',
            color: '#ffffff', fontWeight: '600', fontSize: '0.9rem',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          + Create New Invoice
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap',
        justifyContent: 'space-between', alignItems: 'center', gap: '12px'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 280px', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search by invoice #, client name, or case..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
              borderRadius: '8px', fontSize: '0.9rem', color: '#0f172a'
            }}
          />
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { id: '', label: 'All Invoices' },
            { id: 'DRAFT', label: 'Draft' },
            { id: 'ISSUED', label: 'Issued' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'PAID', label: 'Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'CANCELLED', label: 'Cancelled' }
          ].map((status) => (
            <button
              key={status.id}
              type="button"
              onClick={() => setStatusFilter(status.id)}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600',
                border: '1px solid', cursor: 'pointer',
                backgroundColor: statusFilter === status.id ? '#0f172a' : '#f8fafc',
                color: statusFilter === status.id ? '#ffffff' : '#475569',
                borderColor: statusFilter === status.id ? '#0f172a' : '#cbd5e1'
              }}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table Container */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading invoices...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#b91c1c' }}>{error}</div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: '600', color: '#334155' }}>
              No invoices found
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Create a new invoice or adjust your status search filter above.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Invoice #</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Client / Matter</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Date & Due</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Due (₹)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Invoice # */}
                    <td style={{ padding: '14px 16px', fontWeight: '700' }}>
                      <Link
                        to={`/invoices/${inv.id}`}
                        style={{ color: '#2563eb', textDecoration: 'none' }}
                      >
                        {inv.invoice_number}
                      </Link>
                      {inv.rcm_applicable ? (
                        <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: '600', marginTop: '2px' }}>
                          ⚖️ RCM (0% GST)
                        </div>
                      ) : null}
                    </td>

                    {/* Client & Matter */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{inv.client_name}</div>
                      {inv.case_title ? (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                          {inv.case_number ? `${inv.case_number} - ` : ''}{inv.case_title}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>General Matter</div>
                      )}
                    </td>

                    {/* Dates */}
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                      <div style={{ color: '#334155' }}>Issue: {inv.issue_date || 'Draft'}</div>
                      <div style={{ color: '#64748b', marginTop: '2px' }}>Due: {inv.due_date}</div>
                    </td>

                    {/* Total Amount */}
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                      ₹{parseFloat(inv.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Amount Due */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <span style={{
                        fontWeight: '700',
                        color: parseFloat(inv.amount_due) > 0 ? '#b91c1c' : '#059669'
                      }}>
                        ₹{parseFloat(inv.amount_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {parseFloat(inv.amount_paid) > 0 && parseFloat(inv.amount_due) > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Paid: ₹{parseFloat(inv.amount_paid).toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <InvoiceStatusBadge status={inv.status} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* View Details */}
                        <Link
                          to={`/invoices/${inv.id}`}
                          style={{
                            padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff', color: '#334155', textDecoration: 'none',
                            fontSize: '0.8rem', fontWeight: '600'
                          }}
                        >
                          View
                        </Link>

                        {/* Issue Draft */}
                        {inv.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => handleIssueInvoice(inv.id)}
                            style={{
                              padding: '5px 10px', borderRadius: '6px', border: 'none',
                              backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.8rem',
                              fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            Issue
                          </button>
                        )}

                        {/* PDF Download */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={downloadingId === inv.id}
                          title="Download Chambers Invoice PDF"
                          style={{
                            padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.8rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center'
                          }}
                        >
                          <IconDownload size={15} />
                        </button>

                        {/* Record Payment */}
                        {parseFloat(inv.amount_due) > 0 && inv.status !== 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => setPayingInvoice(inv)}
                            style={{
                              padding: '5px 10px', borderRadius: '6px', border: 'none',
                              backgroundColor: '#059669', color: '#ffffff', fontSize: '0.8rem',
                              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <IconPayment size={14} />
                            Pay
                          </button>
                        )}

                        {/* Payment History */}
                        {parseFloat(inv.amount_paid) > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              const detail = await invoiceService.getInvoiceById(inv.id);
                              setHistoryInvoice({ invoice: inv, payments: detail.data?.payments || [] });
                            }}
                            title="View Payments & Receipts"
                            style={{
                              padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff', color: '#059669', fontSize: '0.8rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                          >
                            <IconReceipt size={15} />
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

      {/* Record Payment Modal */}
      {payingInvoice && (
        <RecordPaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => {
            fetchInvoices();
          }}
        />
      )}

      {/* Payment Receipts History Modal */}
      {historyInvoice && (
        <PaymentHistoryModal
          invoice={historyInvoice.invoice}
          payments={historyInvoice.payments}
          onClose={() => setHistoryInvoice(null)}
          onRefundSuccess={() => {
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
