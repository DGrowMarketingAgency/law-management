import React, { useState, useEffect } from 'react';
import { workforceService } from '../../services/workforceService';
import { useAuth } from '../../context/AuthContext';
import { IconCheckSquare, IconClose } from '../../components/common/Icons';

const LeaveManagementPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    total_days: 1,
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError(null);

      const [typesRes, reqsRes] = await Promise.all([
        workforceService.getLeaveTypes(),
        workforceService.getLeaveRequests({ status: statusFilter }),
      ]);

      if (typesRes.success) setLeaveTypes(typesRes.data || []);
      if (reqsRes.success) setRequests(reqsRes.requests || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch leave records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter]);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // Determine member's workforce ID
      const dir = await workforceService.getDirectory({ limit: 1 });
      const myProfile = dir.profiles?.find((p) => p.user_id === user?.id) || dir.profiles?.[0];
      if (!myProfile) {
        alert('Workforce member profile not found for current user.');
        return;
      }
      await workforceService.applyLeave(myProfile.id, applyForm);
      setShowApplyModal(false);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Leave application failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcess = async (id, action) => {
    if (action === 'REJECT') {
      setSelectedRequest(id);
      setShowRejectModal(true);
      return;
    }
    if (!window.confirm('Approve this leave request? This will deduct the balance and sync with Chambers attendance.')) {
      return;
    }
    try {
      await workforceService.processLeaveRequest(id, 'APPROVE');
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Leave approval failed');
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await workforceService.processLeaveRequest(selectedRequest, 'REJECT', rejectionReason);
      setShowRejectModal(false);
      setRejectionReason('');
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Leave rejection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
            Leave Governance & Absence Ledger
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Casual, Sick, Annual, and Intern Academic Examination leaves with balance tracking.
          </p>
        </div>

        <button
          onClick={() => {
            if (leaveTypes.length > 0 && !applyForm.leave_type_id) {
              setApplyForm((prev) => ({ ...prev, leave_type_id: leaveTypes[0].id }));
            }
            setShowApplyModal(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '6px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          + Apply For Leave
        </button>
      </div>

      {/* Leave Types Reference Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {leaveTypes.map((lt) => (
          <div key={lt.id} style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{lt.code}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '2px 0 4px 0' }}>{lt.name}</div>
            <div style={{ fontSize: '12px', color: '#475569' }}>
              Quota: <strong>{lt.default_days_per_year} days/yr</strong> • {lt.is_paid ? 'Paid' : 'Unpaid'}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', margin: 0 }}>Leave Applications</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff' }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '12px 16px' }}>Member</th>
                <th style={{ padding: '12px 16px' }}>Leave Type</th>
                <th style={{ padding: '12px 16px' }}>Duration</th>
                <th style={{ padding: '12px 16px' }}>Total Days</th>
                <th style={{ padding: '12px 16px' }}>Reason</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading leave requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{r.first_name} {r.last_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{r.workforce_code} • {r.designation}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                      {r.leave_type_name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.start_date} to {r.end_date}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                      {r.total_days} day(s)
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '250px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.reason}
                      </div>
                      {r.rejection_reason && (
                        <div style={{ fontSize: '11px', color: '#b91c1c' }}>Rejection: {r.rejection_reason}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: r.status === 'APPROVED' ? '#ecfdf5' : (r.status === 'PENDING' ? '#eff6ff' : '#fef2f2'),
                          color: r.status === 'APPROVED' ? '#047857' : (r.status === 'PENDING' ? '#1d4ed8' : '#b91c1c'),
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {r.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleProcess(r.id, 'APPROVE')}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '4px',
                              backgroundColor: '#10b981',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleProcess(r.id, 'REJECT')}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '4px',
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '460px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px' }}>Apply for Chambers Leave</h3>
            <form onSubmit={handleApplySubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Leave Type *</label>
                <select
                  required
                  value={applyForm.leave_type_id}
                  onChange={(e) => setApplyForm({ ...applyForm, leave_type_id: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Start Date *</label>
                  <input
                    type="date"
                    required
                    value={applyForm.start_date}
                    onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>End Date *</label>
                  <input
                    type="date"
                    required
                    value={applyForm.end_date}
                    onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Total Working Days *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={applyForm.total_days}
                  onChange={(e) => setApplyForm({ ...applyForm, total_days: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Reason for Absence *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Provide context for Chambers records."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowApplyModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: '600' }}>Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '400px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>Reject Leave Request</h3>
            <form onSubmit={handleConfirmReject}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Reason for Rejection *</label>
                <textarea
                  required
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowRejectModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: '600' }}>Confirm Rejection</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagementPage;
