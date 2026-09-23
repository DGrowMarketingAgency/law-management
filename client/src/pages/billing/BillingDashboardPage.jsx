import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import billingService from '../../services/billingService';
import {
  IconInvoice,
  IconPayment,
  IconRetainer,
  IconHourglass,
  IconDownload
} from '../../components/common/Icons';

export const BillingDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await billingService.getDashboard();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load billing dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (type) => {
    try {
      setExporting(true);
      const blob = await billingService.exportCsv(type);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-chambers-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV: ' + (err.message || 'Error'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
        <p>Loading billing dashboard & aging metrics...</p>
      </div>
    );
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

  const kpis = data?.kpis || {};
  const aging = data?.aging || {};

  return (
    <div className="billing-dashboard" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: '16px', marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
            Chambers Billing & Revenue Management
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Advocate fee notes, client invoices, GST/RCM tracking, trust retainers, and aging recovery.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button
            type="button"
            onClick={() => handleExportCsv('invoices')}
            disabled={exporting}
            style={{
              padding: '9px 16px', border: '1px solid #cbd5e1', borderRadius: '8px',
              backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '600',
              fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <IconDownload size={15} />
            {exporting ? 'Exporting...' : 'CA / Tax CSV Export'}
          </button>
          <Link
            to="/fee-entries"
            style={{
              padding: '9px 16px', border: '1px solid #cbd5e1', borderRadius: '8px',
              backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '600',
              fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <IconHourglass size={15} />
            Log Billable Time
          </Link>
          <Link
            to="/invoices/new"
            style={{
              padding: '9px 18px', borderRadius: '8px', backgroundColor: '#0f172a',
              color: '#ffffff', fontWeight: '600', fontSize: '0.85rem',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            + Create New Invoice
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Total Billed */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>TOTAL BILLED</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <IconInvoice size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0f172a' }}>
            ₹{kpis.totalBilled?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Across {kpis.totalInvoices} issued invoices (Inc. ₹{kpis.totalTax?.toLocaleString('en-IN')} GST)
          </div>
        </div>

        {/* Total Collected */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>TOTAL COLLECTED</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#059669' }}>
              <IconPayment size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#059669' }}>
            ₹{kpis.totalCollected?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            {kpis.totalBilled > 0
              ? `${((kpis.totalCollected / kpis.totalBilled) * 100).toFixed(1)}% realization rate`
              : 'Cleared receipts'}
          </div>
        </div>

        {/* Total Outstanding */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>OUTSTANDING DUES</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#fff1f2', color: '#e11d48' }}>
              <IconHourglass size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#e11d48' }}>
            ₹{kpis.totalOutstanding?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Pending client recovery
          </div>
        </div>

        {/* Retainers Held */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>RETAINERS IN TRUST</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <IconRetainer size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#7c3aed' }}>
            ₹{kpis.totalRetainersHeld?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Client security deposits
          </div>
        </div>

        {/* Unbilled Services */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>UNBILLED FEES</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#d97706' }}>
              <IconHourglass size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#d97706' }}>
            ₹{kpis.totalUnbilledAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            {kpis.totalUnbilledEntries} billable entries awaiting invoice
          </div>
        </div>
      </div>

      {/* Main Content Layout: Aging Table + Recent Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left Column: Aging Analysis */}
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' }}>
                Accounts Receivable Aging Analysis
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Outstanding dues categorized by due date elapsed intervals
              </p>
            </div>
            <Link
              to="/invoices"
              style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}
            >
              View Invoices →
            </Link>
          </div>

          {/* Aging Buckets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { key: 'current', label: 'Current / Not Due', color: '#059669', bg: '#ecfdf5' },
              { key: 'days1To30', label: '1–30 Days Overdue', color: '#d97706', bg: '#fffbeb' },
              { key: 'days31To60', label: '31–60 Days Overdue', color: '#ea580c', bg: '#fff7ed' },
              { key: 'days60Plus', label: '60+ Days Overdue', color: '#dc2626', bg: '#fef2f2' }
            ].map((b) => {
              const bucket = aging[b.key] || { total: 0, count: 0 };
              return (
                <div
                  key={b.key}
                  style={{
                    backgroundColor: b.bg, border: `1px solid ${b.color}33`,
                    borderRadius: '8px', padding: '12px'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: b.color, textTransform: 'uppercase' }}>
                    {b.label}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: '4px 0' }}>
                    ₹{bucket.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {bucket.count} invoice{bucket.count === 1 ? '' : 's'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overdue Items Quick Table */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#334155', marginBottom: '12px' }}>
            Top Outstanding Invoices
          </h3>
          {(!aging.days60Plus?.invoices?.length && !aging.days31To60?.invoices?.length && !aging.days1To30?.invoices?.length) ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.9rem' }}>
              🎉 Excellent! No overdue accounts receivable. All client bills are current or settled.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '8px' }}>Invoice</th>
                    <th style={{ padding: '8px' }}>Client / Matter</th>
                    <th style={{ padding: '8px' }}>Due Date</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Due Amount</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...(aging.days60Plus?.invoices || []),
                    ...(aging.days31To60?.invoices || []),
                    ...(aging.days1To30?.invoices || [])
                  ].slice(0, 6).map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '700', color: '#0f172a' }}>
                        <Link to={`/invoices/${inv.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{inv.client_name}</div>
                        {inv.case_title && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{inv.case_title}</div>}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#64748b' }}>
                        {inv.due_date}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: '#b91c1c' }}>
                        ₹{parseFloat(inv.amount_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <Link
                          to={`/invoices/${inv.id}`}
                          style={{
                            padding: '4px 10px', borderRadius: '4px', backgroundColor: '#0f172a',
                            color: '#ffffff', textDecoration: 'none', fontSize: '0.75rem', fontWeight: '600'
                          }}
                        >
                          Collect
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Recent Collections & Retainer Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Recent Payments Card */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                Recent Collections
              </h2>
              <Link
                to="/payments"
                style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}
              >
                All Receipts →
              </Link>
            </div>

            {(!data.recentPayments || data.recentPayments.length === 0) ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No payment receipts recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.recentPayments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9',
                      backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>
                        {p.client_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {p.payment_number} • {p.payment_mode} • {p.payment_date}
                      </div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#059669' }}>
                      +₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links Card */}
          <div style={{
            backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
              Billing Modules & Compliance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to="/invoices"
                style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px',
                  color: '#0f172a', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600'
                }}
              >
                <span>Chambers Fee Notes & Invoices</span>
                <span>→</span>
              </Link>
              <Link
                to="/fee-entries"
                style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px',
                  color: '#0f172a', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600'
                }}
              >
                <span>Time Sheets & Appearance Log</span>
                <span>→</span>
              </Link>
              <Link
                to="/retainers"
                style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px',
                  color: '#0f172a', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600'
                }}
              >
                <span>Client Retainers (Trust Ledger)</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboardPage;
