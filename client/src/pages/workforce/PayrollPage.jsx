import React, { useState, useEffect } from 'react';
import workforceService from '../../services/workforceService';
import { WorkforceStatusBadge, WorkforceTypeBadge } from '../../components/workforce/WorkforceBadges';
import {
  DollarSign,
  FileText,
  Filter,
  CheckCircle,
  XCircle,
  Plus,
  Calendar,
  AlertCircle,
  CreditCard,
  Download,
  Users,
  Clock,
  Briefcase
} from '../../components/common/Icons';

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState('disbursements');
  const [disbursements, setDisbursements] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  // Modals
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedDisbursement, setSelectedDisbursement] = useState(null);
  const [paymentRef, setPaymentRef] = useState('');

  // Form states
  const [disbursementForm, setDisbursementForm] = useState({
    workforce_id: '',
    disbursement_month: new Date().getMonth() + 1,
    disbursement_year: new Date().getFullYear(),
    gross_amount: '',
    deductions: '0',
    net_amount: '',
    notes: ''
  });

  const [claimForm, setClaimForm] = useState({
    workforce_id: '',
    title: '',
    amount: '',
    category: 'TRAVEL',
    description: '',
    claim_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [activeTab, typeFilter, statusFilter, monthFilter, yearFilter]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'disbursements') {
        const params = {};
        if (typeFilter) params.workforce_type = typeFilter;
        if (statusFilter) params.disbursement_status = statusFilter;
        if (monthFilter) params.disbursement_month = monthFilter;
        if (yearFilter) params.disbursement_year = yearFilter;

        const res = await workforceService.getDisbursements(params);
        setDisbursements(res.data || []);
      } else {
        const params = {};
        if (statusFilter) params.claim_status = statusFilter;
        const res = await workforceService.getReimbursements(params);
        setReimbursements(res.data || []);
      }

      // Load active members for selectors if not loaded
      if (members.length === 0) {
        const memRes = await workforceService.getDirectory({ status: 'ACTIVE', limit: 100 });
        setMembers(memRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load payroll data:', err);
      setError(err.response?.data?.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDisbursement = async (e) => {
    e.preventDefault();
    setError('');
    const targetMember = members.find(m => m.id === parseInt(disbursementForm.workforce_id));
    if (targetMember && targetMember.workforce_type === 'UNPAID_INTERN') {
      setError('Unpaid Interns have stipend disabled and cannot receive salary or stipend disbursements.');
      return;
    }

    try {
      await workforceService.createDisbursement({
        workforce_id: parseInt(disbursementForm.workforce_id),
        disbursement_month: parseInt(disbursementForm.disbursement_month),
        disbursement_year: parseInt(disbursementForm.disbursement_year),
        gross_amount: parseFloat(disbursementForm.gross_amount),
        deductions: parseFloat(disbursementForm.deductions || 0),
        net_amount: parseFloat(disbursementForm.net_amount || disbursementForm.gross_amount),
        notes: disbursementForm.notes
      });
      setSuccessMsg('Disbursement record created successfully.');
      setShowDisbursementModal(false);
      setDisbursementForm({
        workforce_id: '',
        disbursement_month: new Date().getMonth() + 1,
        disbursement_year: new Date().getFullYear(),
        gross_amount: '',
        deductions: '0',
        net_amount: '',
        notes: ''
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create disbursement.');
    }
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!selectedDisbursement) return;
    try {
      await workforceService.markDisbursementPaid(selectedDisbursement.id, {
        payment_reference: paymentRef,
        paid_at: new Date().toISOString().split('T')[0]
      });
      setSuccessMsg('Disbursement marked as PAID successfully.');
      setShowMarkPaidModal(false);
      setSelectedDisbursement(null);
      setPaymentRef('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark disbursement as paid.');
    }
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    try {
      await workforceService.submitReimbursement(parseInt(claimForm.workforce_id), {
        title: claimForm.title,
        amount: parseFloat(claimForm.amount),
        category: claimForm.category,
        description: claimForm.description,
        claim_date: claimForm.claim_date
      });
      setSuccessMsg('Reimbursement claim submitted successfully.');
      setShowClaimModal(false);
      setClaimForm({
        workforce_id: '',
        title: '',
        amount: '',
        category: 'TRAVEL',
        description: '',
        claim_date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit claim.');
    }
  };

  const handleProcessClaim = async (claimId, action) => {
    let rejectionReason = '';
    if (action === 'REJECT') {
      rejectionReason = prompt('Please enter rejection reason:');
      if (!rejectionReason) return;
    }
    try {
      await workforceService.processReimbursement(claimId, action, rejectionReason);
      setSuccessMsg(`Claim ${action === 'APPROVE' ? 'approved' : action === 'MARK_PAID' ? 'marked paid' : 'rejected'} successfully.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process claim.');
    }
  };

  // Calculations for stats
  const totalDisbursed = disbursements
    .filter(d => d.disbursement_status === 'PAID')
    .reduce((sum, d) => sum + parseFloat(d.net_amount || 0), 0);

  const pendingDisbursements = disbursements
    .filter(d => d.disbursement_status === 'PENDING')
    .reduce((sum, d) => sum + parseFloat(d.net_amount || 0), 0);

  const internStipendTotal = disbursements
    .filter(d => d.workforce_type === 'PAID_INTERN' && d.disbursement_status === 'PAID')
    .reduce((sum, d) => sum + parseFloat(d.net_amount || 0), 0);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            Workforce Payroll & Stipends
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Internal employee salaries, paid intern stipends, and chambers expense reimbursements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'disbursements' ? (
            <button
              onClick={() => setShowDisbursementModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Plus size={16} />
              Create Disbursement
            </button>
          ) : (
            <button
              onClick={() => setShowClaimModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Plus size={16} />
              Submit Expense Claim
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#15803d', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>TOTAL DISBURSED</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>₹{totalDisbursed.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>Paid disbursements</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>PENDING DISBURSEMENTS</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>₹{pendingDisbursements.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>Awaiting release</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>INTERN STIPENDS PAID</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <Briefcase size={20} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>₹{internStipendTotal.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '4px' }}>Paid intern disbursements</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>UNPAID INTERNS POLICY</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Strict Guard Enforced</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Stipend disbursements strictly blocked</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          onClick={() => { setActiveTab('disbursements'); setStatusFilter(''); }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            color: activeTab === 'disbursements' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'disbursements' ? '2px solid #0284c7' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Salary & Stipend Disbursements
        </button>
        <button
          onClick={() => { setActiveTab('claims'); setStatusFilter(''); }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            color: activeTab === 'claims' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'claims' ? '2px solid #0284c7' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          Expense Reimbursement Claims
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <Filter size={16} style={{ color: '#64748b' }} />

        {activeTab === 'disbursements' ? (
          <>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="">All Member Types</option>
              <option value="EMPLOYEE">Employees</option>
              <option value="PAID_INTERN">Paid Interns</option>
              <option value="CONTRACTOR">Contractors</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </>
        ) : (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAID">Paid</option>
          </select>
        )}

        {(typeFilter || statusFilter || monthFilter || yearFilter !== new Date().getFullYear().toString()) && (
          <button
            onClick={() => {
              setTypeFilter('');
              setStatusFilter('');
              setMonthFilter('');
              setYearFilter(new Date().getFullYear().toString());
            }}
            style={{ fontSize: '13px', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          Loading payroll records...
        </div>
      ) : activeTab === 'disbursements' ? (
        /* Disbursements Table */
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Disbursement Code</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Member</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Period</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Gross</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Deductions</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Net Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {disbursements.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No disbursement records found for the selected period.
                  </td>
                </tr>
              ) : (
                disbursements.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>
                      {d.disbursement_code || `PAY-${d.id}`}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{d.full_name}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <WorkforceTypeBadge type={d.workforce_type} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{d.workforce_code}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {new Date(2000, d.disbursement_month - 1, 1).toLocaleString('default', { month: 'short' })} {d.disbursement_year}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      ₹{parseFloat(d.gross_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#dc2626' }}>
                      -₹{parseFloat(d.deductions || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                      ₹{parseFloat(d.net_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: d.disbursement_status === 'PAID' ? '#dcfce7' : '#fef3c7',
                          color: d.disbursement_status === 'PAID' ? '#166534' : '#92400e'
                        }}
                      >
                        {d.disbursement_status === 'PAID' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {d.disbursement_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {d.disbursement_status === 'PENDING' && (
                        <button
                          onClick={() => {
                            setSelectedDisbursement(d);
                            setShowMarkPaidModal(true);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#0284c7',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Mark as Paid
                        </button>
                      )}
                      {d.disbursement_status === 'PAID' && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Ref: {d.payment_reference || 'N/A'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Reimbursements Table */
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Claim Code</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Member</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Title & Category</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Claim Date</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reimbursements.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No expense reimbursement claims found.
                  </td>
                </tr>
              ) : (
                reimbursements.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>
                      {c.claim_code || `CLM-${c.id}`}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{c.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{c.workforce_code}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{c.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px' }}>
                        <span style={{ textTransform: 'capitalize' }}>{c.category?.toLowerCase()}</span>
                        {c.description && <span>• {c.description.slice(0, 30)}...</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                      ₹{parseFloat(c.amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                      {c.claim_date}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor:
                            c.claim_status === 'PAID'
                              ? '#dcfce7'
                              : c.claim_status === 'APPROVED'
                              ? '#e0f2fe'
                              : c.claim_status === 'REJECTED'
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            c.claim_status === 'PAID'
                              ? '#166534'
                              : c.claim_status === 'APPROVED'
                              ? '#0369a1'
                              : c.claim_status === 'REJECTED'
                              ? '#991b1b'
                              : '#92400e'
                        }}
                      >
                        {c.claim_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {c.claim_status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleProcessClaim(c.id, 'APPROVE')}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleProcessClaim(c.id, 'REJECT')}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {c.claim_status === 'APPROVED' && (
                          <button
                            onClick={() => handleProcessClaim(c.id, 'MARK_PAID')}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#0284c7',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Mark Paid
                          </button>
                        )}
                        {c.claim_status === 'PAID' && (
                          <span style={{ fontSize: '12px', color: '#16a34a' }}>Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Disbursement */}
      {showDisbursementModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0' }}>
              Create Salary / Stipend Disbursement
            </h2>

            <form onSubmit={handleCreateDisbursement}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Member *
                </label>
                <select
                  required
                  value={disbursementForm.workforce_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const mem = members.find(m => m.id === parseInt(selId));
                    let autoGross = '';
                    if (mem) {
                      if (mem.workforce_type === 'PAID_INTERN') {
                        autoGross = mem.monthly_stipend || '';
                      } else if (mem.workforce_type === 'EMPLOYEE') {
                        autoGross = mem.base_salary || '';
                      }
                    }
                    setDisbursementForm({
                      ...disbursementForm,
                      workforce_id: selId,
                      gross_amount: autoGross,
                      net_amount: autoGross
                    });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option
                      key={m.id}
                      value={m.id}
                      disabled={m.workforce_type === 'UNPAID_INTERN'}
                    >
                      {m.first_name} {m.last_name} ({m.workforce_code} - {m.workforce_type})
                      {m.workforce_type === 'UNPAID_INTERN' ? ' [UNPAID BLOCKED]' : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Note: Unpaid interns are disabled in accordance with policy.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Month *
                  </label>
                  <select
                    required
                    value={disbursementForm.disbursement_month}
                    onChange={(e) => setDisbursementForm({ ...disbursementForm, disbursement_month: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Year *
                  </label>
                  <input
                    type="number"
                    required
                    value={disbursementForm.disbursement_year}
                    onChange={(e) => setDisbursementForm({ ...disbursementForm, disbursement_year: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Gross Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={disbursementForm.gross_amount}
                    onChange={(e) => {
                      const gross = parseFloat(e.target.value) || 0;
                      const ded = parseFloat(disbursementForm.deductions) || 0;
                      setDisbursementForm({
                        ...disbursementForm,
                        gross_amount: e.target.value,
                        net_amount: (gross - ded).toString()
                      });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Deductions (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={disbursementForm.deductions}
                    onChange={(e) => {
                      const ded = parseFloat(e.target.value) || 0;
                      const gross = parseFloat(disbursementForm.gross_amount) || 0;
                      setDisbursementForm({
                        ...disbursementForm,
                        deductions: e.target.value,
                        net_amount: (gross - ded).toString()
                      });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Net Payable Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  readOnly
                  value={disbursementForm.net_amount}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: '600' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Notes / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g., Monthly stipend release with pro-rata attendance adjustment"
                  value={disbursementForm.notes}
                  onChange={(e) => setDisbursementForm({ ...disbursementForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDisbursementModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Mark Paid */}
      {showMarkPaidModal && selectedDisbursement && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px 0' }}>
              Confirm Payment Release
            </h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
              Marking <strong>₹{parseFloat(selectedDisbursement.net_amount).toLocaleString()}</strong> as paid to <strong>{selectedDisbursement.full_name}</strong>.
            </p>

            <form onSubmit={handleMarkPaid}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Bank Transaction / UTR / Reference No. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., UTR-2026-904818"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowMarkPaidModal(false); setSelectedDisbursement(null); }}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submit Claim */}
      {showClaimModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0' }}>
              Submit Expense Reimbursement
            </h2>

            <form onSubmit={handleSubmitClaim}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Workforce Member *
                </label>
                <select
                  required
                  value={claimForm.workforce_id}
                  onChange={(e) => setClaimForm({ ...claimForm, workforce_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.workforce_code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Court Filing Fee / Supreme Court Travel"
                  value={claimForm.title}
                  onChange={(e) => setClaimForm({ ...claimForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={claimForm.amount}
                    onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    required
                    value={claimForm.category}
                    onChange={(e) => setClaimForm({ ...claimForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="TRAVEL">Travel / Cab</option>
                    <option value="COURT_FEES">Court Fees</option>
                    <option value="CLIENT_MEETING">Client Meeting Food</option>
                    <option value="STATIONERY">Stationery & Print</option>
                    <option value="OTHER">Other Chambers Expense</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Date Incurred *
                </label>
                <input
                  type="date"
                  required
                  value={claimForm.claim_date}
                  onChange={(e) => setClaimForm({ ...claimForm, claim_date: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Description / Receipt Notes
                </label>
                <textarea
                  rows="3"
                  placeholder="Provide details of expenditure..."
                  value={claimForm.description}
                  onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
