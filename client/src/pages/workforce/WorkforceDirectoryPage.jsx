import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workforceService } from '../../services/workforceService';
import { WorkforceTypeBadge, WorkforceStatusBadge } from '../../components/workforce/WorkforceBadges';
import { IconUsers, IconSearch, IconClose, IconBriefcase } from '../../components/common/Icons';

const WorkforceDirectoryPage = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null); // { type: 'success' | 'error', text: '' }
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Open action dropdown tracking
  const [openMenuId, setOpenMenuId] = useState(null);

  // Deactivate Modal state
  const [deactivateModal, setDeactivateModal] = useState({ open: false, profile: null, reason: '', submitting: false, error: null });

  // Activate Modal state
  const [activateModal, setActivateModal] = useState({ open: false, profile: null, submitting: false, error: null });

  // Restore Modal state
  const [restoreModal, setRestoreModal] = useState({ open: false, profile: null, reason: '', submitting: false, error: null });

  // Delete / Archive Safety Modal state
  const [safetyModal, setSafetyModal] = useState({
    open: false,
    profile: null,
    loading: false,
    safetyData: null,
    action: 'ARCHIVE', // 'ARCHIVE' | 'PERMANENT_DELETE'
    confirmationCode: '',
    submitting: false,
    error: null,
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    workforce_type: 'EMPLOYEE',
    designation: 'Associate Advocate',
    department: 'Litigation & Dispute Resolution',
    joining_date: new Date().toISOString().slice(0, 10),
    expected_end_date: '',
    college_institution: '',
    stipend_amount: 0,
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await workforceService.getDirectory({
        search,
        workforce_type: typeFilter,
        status: statusFilter,
        page: pagination.page,
        limit: 15,
      });
      if (res.success) {
        setProfiles(res.profiles || []);
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [pagination.page, typeFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchDirectory();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setModalSubmitting(true);
      setModalError(null);
      const res = await workforceService.createProfile(formData);
      if (res.success) {
        setShowAddModal(false);
        showToast('success', 'Workforce member profile created successfully.');
        fetchDirectory();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create member');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Lifecycle Action Handlers
  const handleOpenActivate = (p) => {
    setActivateModal({ open: true, profile: p, submitting: false, error: null });
    setOpenMenuId(null);
  };

  const handleConfirmActivate = async () => {
    try {
      setActivateModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await workforceService.activateProfile(activateModal.profile.id);
      if (res.success) {
        showToast('success', `${activateModal.profile.first_name} activated successfully.`);
        setActivateModal({ open: false, profile: null, submitting: false, error: null });
        fetchDirectory();
      }
    } catch (err) {
      setActivateModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Activation failed.',
      }));
    }
  };

  const handleOpenDeactivate = (p) => {
    setDeactivateModal({ open: true, profile: p, reason: '', submitting: false, error: null });
    setOpenMenuId(null);
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModal.reason.trim()) {
      setDeactivateModal((prev) => ({ ...prev, error: 'Please specify a reason for deactivation.' }));
      return;
    }
    try {
      setDeactivateModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await workforceService.deactivateProfile(deactivateModal.profile.id, deactivateModal.reason);
      if (res.success) {
        showToast('success', `${deactivateModal.profile.first_name} has been deactivated.`);
        setDeactivateModal({ open: false, profile: null, reason: '', submitting: false, error: null });
        fetchDirectory();
      }
    } catch (err) {
      setDeactivateModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Deactivation failed.',
      }));
    }
  };

  const handleOpenRestore = (p) => {
    setRestoreModal({ open: true, profile: p, reason: '', submitting: false, error: null });
    setOpenMenuId(null);
  };

  const handleConfirmRestore = async () => {
    try {
      setRestoreModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await workforceService.restoreProfile(restoreModal.profile.id, restoreModal.reason);
      if (res.success) {
        showToast('success', `${restoreModal.profile.first_name} restored to active status.`);
        setRestoreModal({ open: false, profile: null, reason: '', submitting: false, error: null });
        fetchDirectory();
      }
    } catch (err) {
      setRestoreModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Restoration failed.',
      }));
    }
  };

  const handleResetPassword = async (p) => {
    setOpenMenuId(null);
    if (!window.confirm(`Send secure single-use password reset link to ${p.email}?`)) {
      return;
    }
    try {
      const res = await workforceService.resetPassword(p.id);
      showToast('success', res.message || `Password reset link sent to ${p.email}`);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to send password reset link.');
    }
  };

  const handleResendInvitation = async (p) => {
    setOpenMenuId(null);
    try {
      const res = await workforceService.resendInvitation(p.id);
      showToast('success', res.message || `Invitation resent to ${p.email}`);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to resend invitation.');
    }
  };

  const handleOpenSafetyModal = async (p) => {
    setOpenMenuId(null);
    setSafetyModal({
      open: true,
      profile: p,
      loading: true,
      safetyData: null,
      action: 'ARCHIVE',
      confirmationCode: '',
      submitting: false,
      error: null,
    });

    try {
      const res = await workforceService.getDeletionSafety(p.id);
      if (res.success) {
        setSafetyModal((prev) => ({
          ...prev,
          loading: false,
          safetyData: res.data,
          action: 'ARCHIVE',
        }));
      }
    } catch (err) {
      setSafetyModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || 'Failed to fetch deletion safety check.',
      }));
    }
  };

  const handleConfirmArchiveDelete = async () => {
    const { profile, action, confirmationCode, safetyData } = safetyModal;
    const requiredCode = action === 'ARCHIVE' ? `ARCHIVE ${profile.workforce_code}` : `DELETE ${profile.workforce_code}`;

    if (confirmationCode.trim().toUpperCase() !== requiredCode) {
      setSafetyModal((prev) => ({ ...prev, error: `Please type "${requiredCode}" exactly to confirm.` }));
      return;
    }

    try {
      setSafetyModal((prev) => ({ ...prev, submitting: true, error: null }));
      if (action === 'ARCHIVE') {
        const res = await workforceService.archiveProfile(profile.id, confirmationCode);
        showToast('success', res.message || 'Profile successfully archived.');
      } else {
        const res = await workforceService.permanentDeleteProfile(profile.id, confirmationCode);
        showToast('success', res.message || 'Profile permanently deleted.');
      }
      setSafetyModal({
        open: false,
        profile: null,
        loading: false,
        safetyData: null,
        action: 'ARCHIVE',
        confirmationCode: '',
        submitting: false,
        error: null,
      });
      fetchDirectory();
    } catch (err) {
      setSafetyModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Action failed.',
      }));
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: toastMsg.type === 'success' ? '#0f766e' : '#b91c1c',
            color: '#ffffff',
            fontWeight: '500',
            fontSize: '13px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <span>{toastMsg.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
            Workforce Directory & Members
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Active Advocates, Senior Associates, Legal Interns, and Chambers Administrative Personnel.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
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
          + Add New Member
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by name, code (EMP/INT), email, designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
              <IconSearch size={16} />
            </span>
          </div>

          <div style={{ flex: '0 1 180px' }}>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Workforce Types</option>
              <option value="EMPLOYEE">Employees (Advocates)</option>
              <option value="PAID_INTERN">Paid Interns</option>
              <option value="UNPAID_INTERN">Unpaid Interns</option>
              <option value="CONTRACTOR">Contractors / Retainers</option>
            </select>
          </div>

          <div style={{ flex: '0 1 160px' }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="ON_NOTICE">On Notice</option>
              <option value="EXITED">Exited</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <button
            type="submit"
            style={{
              padding: '9px 16px',
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Directory Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '12px 16px' }}>Code</th>
                <th style={{ padding: '12px 16px' }}>Member</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Designation & Dept</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Onboarding</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading directory records...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No workforce members match the search criteria.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {p.workforce_code}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>
                        {p.first_name} {p.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {p.email} • {p.phone}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <WorkforceTypeBadge type={p.workforce_type} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: '#0f172a', fontWeight: '500' }}>{p.designation}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{p.department}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <WorkforceStatusBadge status={p.status} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.pending_mandatory_onboarding > 0 ? (
                        <span style={{ fontSize: '12px', color: '#b45309', fontWeight: '500' }}>
                          ⚠️ {p.pending_mandatory_onboarding} pending
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '500' }}>
                          ✓ Complete
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', position: 'relative' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Link
                          to={`/workforce/profiles/${p.id}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '5px',
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'inline-block',
                          }}
                        >
                          View
                        </Link>
                        <Link
                          to={`/workforce/profiles/${p.id}/edit`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '5px',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'inline-block',
                          }}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: openMenuId === p.id ? '#e2e8f0' : '#ffffff',
                            color: '#0f172a',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '700',
                            lineHeight: 1,
                          }}
                          title="More options"
                        >
                          •••
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {openMenuId === p.id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '16px',
                            top: '44px',
                            zIndex: 100,
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
                            minWidth: '180px',
                            textAlign: 'left',
                            padding: '6px 0',
                          }}
                        >
                          {p.status !== 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleOpenActivate(p)}
                              style={{
                                width: '100%',
                                padding: '8px 14px',
                                border: 'none',
                                background: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: '#15803d',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              ✓ Activate Member
                            </button>
                          )}

                          {p.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeactivate(p)}
                              style={{
                                width: '100%',
                                padding: '8px 14px',
                                border: 'none',
                                background: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: '#d97706',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fefce8')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              ⏸ Deactivate Member
                            </button>
                          )}

                          {['INACTIVE', 'SUSPENDED', 'EXITED'].includes(p.status) && (
                            <button
                              type="button"
                              onClick={() => handleOpenRestore(p)}
                              style={{
                                width: '100%',
                                padding: '8px 14px',
                                border: 'none',
                                background: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: '#0369a1',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              ↺ Restore Member
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleResetPassword(p)}
                            style={{
                              width: '100%',
                              padding: '8px 14px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              fontSize: '13px',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            🔑 Reset Password
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResendInvitation(p)}
                            style={{
                              width: '100%',
                              padding: '8px 14px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              fontSize: '13px',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            ✉ Resend Invite
                          </button>

                          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

                          <button
                            type="button"
                            onClick={() => handleOpenSafetyModal(p)}
                            style={{
                              width: '100%',
                              padding: '8px 14px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              fontSize: '13px',
                              color: '#dc2626',
                              fontWeight: '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            🗑 Archive / Delete
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

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b' }}>
          <div>
            Showing {profiles.length} of {pagination.total} total members
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                opacity: pagination.page <= 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <span style={{ padding: '5px 10px', fontWeight: '600' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Add New Chambers Member
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <IconClose size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Workforce Type *
                  </label>
                  <select
                    value={formData.workforce_type}
                    onChange={(e) => setFormData({ ...formData, workforce_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="EMPLOYEE">Employee (Advocate / Associate)</option>
                    <option value="PAID_INTERN">Paid Legal Intern</option>
                    <option value="UNPAID_INTERN">Unpaid Legal Intern</option>
                    <option value="CONTRACTOR">Contractor / Counsel Retainer</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Joining Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Conditional Fields for Interns */}
              {formData.workforce_type.includes('INTERN') && (
                <div style={{ padding: '14px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', marginBottom: '14px' }}>
                  <div style={{ fontWeight: '600', fontSize: '12px', color: '#92400e', marginBottom: '10px' }}>
                    Internship Specific Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#78350f', marginBottom: '4px' }}>
                        College / Law Institution
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Faculty of Law, DU"
                        value={formData.college_institution}
                        onChange={(e) => setFormData({ ...formData, college_institution: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#78350f', marginBottom: '4px' }}>
                        Monthly Stipend (₹) {formData.workforce_type === 'UNPAID_INTERN' ? '(Disabled for Unpaid)' : ''}
                      </label>
                      <input
                        type="number"
                        disabled={formData.workforce_type === 'UNPAID_INTERN'}
                        value={formData.workforce_type === 'UNPAID_INTERN' ? 0 : formData.stipend_amount}
                        onChange={(e) => setFormData({ ...formData, stipend_amount: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          backgroundColor: formData.workforce_type === 'UNPAID_INTERN' ? '#f3f4f6' : '#ffffff',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {modalSubmitting ? 'Creating...' : 'Create Member Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate Member Modal */}
      {activateModal.open && activateModal.profile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>
              Activate Workforce Member
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              You are activating <strong>{activateModal.profile.first_name} {activateModal.profile.last_name}</strong> ({activateModal.profile.workforce_code}).
            </p>

            {activateModal.profile.pending_mandatory_onboarding > 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#fefce8',
                  border: '1px solid #fef08a',
                  color: '#854d0e',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                ⚠️ <strong>Onboarding Warning:</strong> This member currently has{' '}
                <strong>{activateModal.profile.pending_mandatory_onboarding}</strong> mandatory checklist items pending. Activating will provision system credentials immediately.
              </div>
            )}

            {activateModal.error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {activateModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setActivateModal({ open: false, profile: null, submitting: false, error: null })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmActivate}
                disabled={activateModal.submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: activateModal.submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {activateModal.submitting ? 'Activating...' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Member Modal */}
      {deactivateModal.open && deactivateModal.profile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>
              Deactivate Workforce Member
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Deactivating <strong>{deactivateModal.profile.first_name} {deactivateModal.profile.last_name}</strong> ({deactivateModal.profile.workforce_code}) will revoke all active login sessions and suspend platform access.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Reason for Deactivation *
              </label>
              <textarea
                rows="3"
                value={deactivateModal.reason}
                onChange={(e) => setDeactivateModal({ ...deactivateModal, reason: e.target.value })}
                placeholder="Specify the operational or administrative reason..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {deactivateModal.error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {deactivateModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setDeactivateModal({ open: false, profile: null, reason: '', submitting: false, error: null })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={deactivateModal.submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: deactivateModal.submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {deactivateModal.submitting ? 'Deactivating...' : 'Deactivate Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Member Modal */}
      {restoreModal.open && restoreModal.profile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>
              Restore Workforce Member
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Restoring <strong>{restoreModal.profile.first_name} {restoreModal.profile.last_name}</strong> ({restoreModal.profile.workforce_code}) will return their status to <strong>ACTIVE</strong> and reactivate platform credentials.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Restoration Notes (Optional)
              </label>
              <textarea
                rows="2"
                value={restoreModal.reason}
                onChange={(e) => setRestoreModal({ ...restoreModal, reason: e.target.value })}
                placeholder="e.g. Return from leave, contract renewal, reinstatement..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {restoreModal.error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {restoreModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setRestoreModal({ open: false, profile: null, reason: '', submitting: false, error: null })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoreModal.submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#0369a1',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: restoreModal.submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {restoreModal.submitting ? 'Restoring...' : 'Restore to Active'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Check & Archive/Delete Modal */}
      {safetyModal.open && safetyModal.profile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
              Member Deletion Safety Check
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Target: <strong>{safetyModal.profile.first_name} {safetyModal.profile.last_name}</strong> ({safetyModal.profile.workforce_code})
            </p>

            {safetyModal.loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Analyzing database dependencies across cases, billing, attendance, and documents...
              </div>
            ) : safetyModal.safetyData ? (
              <div>
                {/* Dependency Counts Breakdown Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Assigned Cases</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {safetyModal.safetyData.counts.assignedCases}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Documents</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {safetyModal.safetyData.counts.documents}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Attendance Logs</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {safetyModal.safetyData.counts.attendance}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Assigned Tasks</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {safetyModal.safetyData.counts.tasks}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Billing / Fees</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {safetyModal.safetyData.counts.billing}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Leave History</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {safetyModal.safetyData.counts.leaves}
                    </div>
                  </div>
                </div>

                {/* Safety Policy Alert */}
                {!safetyModal.safetyData.canPermanentlyDelete ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      borderRadius: '6px',
                      fontSize: '12px',
                      marginBottom: '16px',
                      lineHeight: '1.5',
                    }}
                  >
                    ⛔ <strong>Permanent Deletion Blocked:</strong> Historical case assignments, documents, or attendance records exist. To ensure compliance and audit integrity under Bar regulations, this member can only be <strong>Archived</strong>.
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      borderRadius: '6px',
                      fontSize: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    ✓ No active historical cases or financial entries linked. Both Archival and Permanent Deletion are available.
                  </div>
                )}

                {/* Action Mode Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                    Select Action:
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="safety_action"
                        value="ARCHIVE"
                        checked={safetyModal.action === 'ARCHIVE'}
                        onChange={() => setSafetyModal({ ...safetyModal, action: 'ARCHIVE', confirmationCode: '' })}
                      />
                      <span><strong>Archive Member</strong> (Soft Exit & Compliance Preserved)</span>
                    </label>

                    {safetyModal.safetyData.canPermanentlyDelete && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="safety_action"
                          value="PERMANENT_DELETE"
                          checked={safetyModal.action === 'PERMANENT_DELETE'}
                          onChange={() => setSafetyModal({ ...safetyModal, action: 'PERMANENT_DELETE', confirmationCode: '' })}
                        />
                        <span style={{ color: '#dc2626' }}><strong>Permanent Delete</strong></span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Confirmation Code Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                    Type <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0f172a' }}>
                      {safetyModal.action === 'ARCHIVE' ? `ARCHIVE ${safetyModal.profile.workforce_code}` : `DELETE ${safetyModal.profile.workforce_code}`}
                    </code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={safetyModal.confirmationCode}
                    onChange={(e) => setSafetyModal({ ...safetyModal, confirmationCode: e.target.value })}
                    placeholder={`Type ${safetyModal.action === 'ARCHIVE' ? 'ARCHIVE' : 'DELETE'} ${safetyModal.profile.workforce_code}`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            ) : null}

            {safetyModal.error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {safetyModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() =>
                  setSafetyModal({
                    open: false,
                    profile: null,
                    loading: false,
                    safetyData: null,
                    action: 'ARCHIVE',
                    confirmationCode: '',
                    submitting: false,
                    error: null,
                  })
                }
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchiveDelete}
                disabled={
                  safetyModal.submitting ||
                  safetyModal.loading ||
                  safetyModal.confirmationCode.trim().toUpperCase() !==
                    (safetyModal.action === 'ARCHIVE'
                      ? `ARCHIVE ${safetyModal.profile?.workforce_code}`
                      : `DELETE ${safetyModal.profile?.workforce_code}`)
                }
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: safetyModal.action === 'PERMANENT_DELETE' ? '#dc2626' : '#475569',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor:
                    safetyModal.submitting ||
                    safetyModal.confirmationCode.trim().toUpperCase() !==
                      (safetyModal.action === 'ARCHIVE'
                        ? `ARCHIVE ${safetyModal.profile?.workforce_code}`
                        : `DELETE ${safetyModal.profile?.workforce_code}`)
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    safetyModal.confirmationCode.trim().toUpperCase() !==
                    (safetyModal.action === 'ARCHIVE'
                      ? `ARCHIVE ${safetyModal.profile?.workforce_code}`
                      : `DELETE ${safetyModal.profile?.workforce_code}`)
                      ? 0.5
                      : 1,
                }}
              >
                {safetyModal.submitting
                  ? 'Processing...'
                  : safetyModal.action === 'ARCHIVE'
                  ? 'Confirm Archive'
                  : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceDirectoryPage;

