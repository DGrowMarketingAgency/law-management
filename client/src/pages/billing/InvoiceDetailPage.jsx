import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import invoiceService from '../../services/invoiceService';
import InvoiceStatusBadge from '../../components/billing/InvoiceStatusBadge';
import RecordPaymentModal from '../../components/billing/RecordPaymentModal';
import PaymentHistoryModal from '../../components/billing/PaymentHistoryModal';
import ReminderModal from '../../components/payments/ReminderModal';
import { IconDownload, IconPayment, IconReceipt, IconSend } from '../../components/common/Icons';

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Action States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await invoiceService.getInvoiceById(id);
      setInvoice(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setDownloadingPdf(true);
      await invoiceService.downloadPdf(invoice.id, invoice.invoice_number);
    } catch (err) {
      alert('Failed to download PDF: ' + (err.message || 'Error'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleIssueInvoice = async () => {
    if (!window.confirm('Issue this invoice? This will lock the invoice numbering and create an immutable financial snapshot.')) {
      return;
    }
    try {
      await invoiceService.issueInvoice(invoice.id);
      fetchInvoice();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to issue invoice');
    }
  };

  const handleSendReminder = async () => {
    try {
      setSendingReminder(true);
      await invoiceService.sendReminder(invoice.id, { channel: 'EMAIL' });
      alert('Payment reminder notification sent successfully to client.');
      fetchInvoice();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleCancelInvoice = async () => {
    const reason = window.prompt('Enter reason for cancelling this draft invoice:');
    if (reason === null) return;
    try {
      await invoiceService.cancelInvoice(invoice.id, reason);
      fetchInvoice();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to cancel invoice');
    }
  };

  const handleVoidInvoice = async () => {
    const reason = window.prompt('Enter reason for VOIDING this issued invoice (reverses financial liability):');
    if (reason === null) return;
    try {
      await invoiceService.voidInvoice(invoice.id, reason);
      fetchInvoice();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to void invoice');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading invoice...</div>;
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{
          backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '16px', color: '#b91c1c'
        }}>
          {error || 'Invoice not found'}
        </div>
        <Link to="/invoices" style={{ display: 'inline-block', marginTop: '12px', color: '#2563eb' }}>
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const items = invoice.items || [];
  const payments = invoice.payments || [];
  const snapshot = invoice.snapshot_data ? (typeof invoice.snapshot_data === 'string' ? JSON.parse(invoice.snapshot_data) : invoice.snapshot_data) : null;

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Action Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: '16px', marginBottom: '20px'
      }}>
        <div>
          <Link to="/invoices" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← Back to Invoices
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
              Invoice {invoice.invoice_number}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff', color: '#0f172a', fontSize: '0.85rem',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <IconDownload size={16} />
            {downloadingPdf ? 'Generating...' : 'Download PDF'}
          </button>

          {/* Issue Draft */}
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              onClick={handleIssueInvoice}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.85rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              ⚡ Issue Invoice
            </button>
          )}

          {/* Record Payment */}
          {parseFloat(invoice.amount_due) > 0 && invoice.status !== 'DRAFT' && invoice.status !== 'VOID' && invoice.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: '#059669', color: '#ffffff', fontSize: '0.85rem',
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <IconPayment size={16} />
              Record Payment
            </button>
          )}

          {/* Pay Online Portal Link */}
          {parseFloat(invoice.amount_due) > 0 && invoice.status !== 'DRAFT' && invoice.status !== 'VOID' && invoice.status !== 'CANCELLED' && (
            <Link
              to={`/billing/pay/${invoice.id}`}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid #93c5fd',
                backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.85rem',
                fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              💳 Online Checkout Portal
            </Link>
          )}

          {/* Send Reminder */}
          {parseFloat(invoice.amount_due) > 0 && ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
            <button
              type="button"
              onClick={() => setShowReminderModal(true)}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem',
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <IconSend size={15} />
              Remind Client
            </button>
          )}

          {/* View Receipts */}
          {payments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReceiptsModal(true)}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff', color: '#059669', fontSize: '0.85rem',
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <IconReceipt size={16} />
              Receipts ({payments.length})
            </button>
          )}

          {/* Cancel (Draft only) */}
          {invoice.status === 'DRAFT' && (
            <button
              type="button"
              onClick={handleCancelInvoice}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca',
                backgroundColor: '#fff1f2', color: '#b91c1c', fontSize: '0.85rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cancel Draft
            </button>
          )}

          {/* Void (Issued only) */}
          {['ISSUED', 'SENT', 'OVERDUE'].includes(invoice.status) && parseFloat(invoice.amount_paid) === 0 && (
            <button
              type="button"
              onClick={handleVoidInvoice}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca',
                backgroundColor: '#fff1f2', color: '#b91c1c', fontSize: '0.85rem',
                fontWeight: '600', cursor: 'pointer'
              }}
            >
              Void Invoice
            </button>
          )}
        </div>
      </div>

      {/* Main Invoice Document View */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '36px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px'
      }}>
        {/* Chambers Letterhead & Invoice Metadata Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          borderBottom: '2px solid #0f172a', paddingBottom: '24px', marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
              CHAMBERS OF ADVOCATES
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>High Court & Supreme Court of India</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              GSTIN: 33AAAAA0000A1Z5 • PAN: AAAAA0000A
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
              TAX INVOICE / FEE NOTE
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#2563eb', marginTop: '2px' }}>
              {invoice.invoice_number}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              Date: <strong>{invoice.invoice_date || invoice.issue_date || 'Draft'}</strong>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Due: <strong style={{ color: '#b91c1c' }}>{invoice.due_date}</strong>
            </div>
          </div>
        </div>

        {/* Client & Matter Block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Billed To:
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
              {invoice.client_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>
              {invoice.client_company && <div>{invoice.client_company}</div>}
              {invoice.client_email && <div>{invoice.client_email}</div>}
              {invoice.client_phone && <div>{invoice.client_phone}</div>}
              {invoice.client_gstin && <div>GSTIN: <strong>{invoice.client_gstin}</strong></div>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Matter Details:
            </div>
            {invoice.case_title ? (
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                  {invoice.case_number ? `${invoice.case_number} - ` : ''}{invoice.case_title}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                  Court: {invoice.court_name || 'Designated Court'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                General Advisory & Chambers Retainer
              </div>
            )}
            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#64748b' }}>
              Place of Supply: <strong>{invoice.place_of_supply || 'State'}</strong>
            </div>
          </div>
        </div>

        {/* RCM Alert Banner if applicable */}
        {invoice.rcm_applicable ? (
          <div style={{
            backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '24px', fontSize: '0.85rem', color: '#1e40af'
          }}>
            ⚖️ <strong>Reverse Charge Mechanism (RCM) Applicable:</strong> Under Section 9(3) of the CGST Act, 2017, the tax on legal services provided by an advocate or firm of advocates to any business entity is payable by the recipient of such services.
          </div>
        ) : null}

        {/* Itemized Line Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #0f172a', textAlign: 'left', color: '#0f172a' }}>
              <th style={{ padding: '10px 8px', fontWeight: '700', width: '45%' }}>Service Description</th>
              <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>Rate (₹)</th>
              <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'center' }}>Tax</th>
              <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 8px', color: '#0f172a' }}>
                  <div style={{ fontWeight: '600' }}>{it.description}</div>
                  {it.entry_type && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Fee Type: {it.entry_type}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', color: '#475569' }}>
                  {it.quantity}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#475569' }}>
                  ₹{parseFloat(it.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', color: '#64748b' }}>
                  {invoice.rcm_applicable ? '0% (RCM)' : `${it.tax_rate || 18}%`}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                  ₹{parseFloat(it.line_total ?? it.amount ?? (it.quantity * it.unit_price) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculation Summary Block */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
          <div style={{ width: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Subtotal:</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>
                ₹{parseFloat(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {parseFloat(invoice.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem', color: '#059669' }}>
                <span>Discount:</span>
                <span>-₹{parseFloat(invoice.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Taxable Value:</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>
                ₹{parseFloat(invoice.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {!invoice.rcm_applicable && (
              <>
                {parseFloat(invoice.cgst_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: '#475569' }}>
                    <span>CGST (9%):</span>
                    <span>₹{parseFloat(invoice.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {parseFloat(invoice.sgst_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: '#475569' }}>
                    <span>SGST (9%):</span>
                    <span>₹{parseFloat(invoice.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {parseFloat(invoice.igst_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: '#475569' }}>
                    <span>IGST (18%):</span>
                    <span>₹{parseFloat(invoice.igst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '12px 0',
              borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a',
              marginTop: '8px', fontSize: '1.15rem'
            }}>
              <span style={{ fontWeight: '800', color: '#0f172a' }}>Total Amount:</span>
              <span style={{ fontWeight: '900', color: '#0f172a' }}>
                ₹{parseFloat(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem', color: '#059669' }}>
              <span>Amount Paid:</span>
              <span style={{ fontWeight: '700' }}>
                ₹{parseFloat(invoice.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              fontSize: '1.05rem', color: parseFloat(invoice.amount_due) > 0 ? '#b91c1c' : '#059669',
              fontWeight: '800'
            }}>
              <span>Amount Due:</span>
              <span>₹{parseFloat(invoice.amount_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', fontSize: '0.85rem', color: '#64748b' }}>
          {invoice.notes && (
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#334155' }}>Notes:</strong> {invoice.notes}
            </div>
          )}
          {invoice.terms && (
            <div>
              <strong style={{ color: '#334155' }}>Payment Terms:</strong> {invoice.terms}
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            fetchInvoice();
          }}
        />
      )}

      {/* Payment Receipts History Modal */}
      {showReceiptsModal && (
        <PaymentHistoryModal
          invoice={invoice}
          payments={payments}
          onClose={() => setShowReceiptsModal(false)}
          onRefundSuccess={() => {
            fetchInvoice();
          }}
        />
      )}

      {/* Payment Reminder Modal */}
      {showReminderModal && (
        <ReminderModal
          invoice={invoice}
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          onSuccess={() => {
            fetchInvoice();
          }}
        />
      )}
    </div>
  );
};

export default InvoiceDetailPage;
