import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { workforceService } from '../../services/workforceService';
import { useAuth } from '../../context/AuthContext';
import { WorkforceTypeBadge, WorkforceStatusBadge } from '../../components/workforce/WorkforceBadges';

const WorkforceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab State (10 dedicated tabs)
  const [activeTab, setActiveTab] = useState('overview');

  // Sub-data states for tabs
  const [tabLoading, setTabLoading] = useState(false);
  const [assignedCases, setAssignedCases] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState({ balances: [], requests: [] });
  const [tasksList, setTasksList] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  // Lifecycle Modals
  const [activateModal, setActivateModal] = useState({ open: false, submitting: false, error: null });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, reason: '', submitting: false, error: null });
  const [restoreModal, setRestoreModal] = useState({ open: false, reason: '', submitting: false, error: null });
  const [safetyModal, setSafetyModal] = useState({
    open: false,
    loading: false,
    safetyData: null,
    action: 'ARCHIVE',
    confirmationCode: '',
    submitting: false,
    error: null,
  });

  // Modals for compensation
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ gross_amount: '', basic_amount: '', allowances_amount: '', deductions_amount: '' });
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({ account_holder_name: '', bank_name: '', account_number: '', ifsc: '', upi_id: '' });

  const showNotification = (msg) => {
    setActionMsg(msg);
    setTimeout(() => {
      setActionMsg(null);
    }, 4500);
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await workforceService.getProfile(id);
      if (res.success) {
        setData(res.data);
        if (res.data.assignedCases) {
          setAssignedCases(res.data.assignedCases);
        }
        if (res.data.activeTasks) {
          setTasksList(res.data.activeTasks);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  // Lazy-load tab data when tabs change
  useEffect(() => {
    if (!data?.profile) return;

    const loadTabData = async () => {
      setTabLoading(true);
      try {
        if (activeTab === 'cases') {
          const res = await workforceService.getAssignedCases(id);
          if (res.success) setAssignedCases(res.data || []);
        } else if (activeTab === 'attendance') {
          const res = await workforceService.getAttendanceHistory(id);
          if (res.success) setAttendanceLogs(res.logs || res.data || []);
        } else if (activeTab === 'leave') {
          const res = await workforceService.getLeavesHistory(id);
          if (res.success) {
            setLeaveRecords({
              balances: res.balances || [],
              requests: res.requests || [],
            });
          }
        } else if (activeTab === 'tasks') {
          const res = await workforceService.getTasksList(id);
          if (res.success) setTasksList(res.tasks || res.data || []);
        } else if (activeTab === 'documents') {
          const res = await workforceService.getDocuments(id);
          if (res.success) setDocumentsList(res.data || []);
        } else if (activeTab === 'activity') {
          const res = await workforceService.getActivityAudit(id);
          if (res.success) setActivityLogs(res.logs || res.data || []);
        }
      } catch (err) {
        console.error('Failed to load tab data:', err);
      } finally {
        setTabLoading(false);
      }
    };

    loadTabData();
  }, [activeTab, id, data?.profile]);

  // Checklist Item Toggle
  const handleToggleChecklist = async (itemId, currentStatus) => {
    try {
      setActionLoading(true);
      const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      await workforceService.updateOnboardingChecklistItem(itemId, { status: newStatus });
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update checklist item');
    } finally {
      setActionLoading(false);
    }
  };

  // Lifecycle actions
  const handleConfirmActivate = async () => {
    try {
      setActivateModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await workforceService.activateProfile(id);
      if (res.success) {
        showNotification(`${data.profile.first_name} activated successfully.`);
        setActivateModal({ open: false, submitting: false, error: null });
        fetchProfile();
      }
    } catch (err) {
      setActivateModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Activation failed.',
      }));
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModal.reason.trim()) {
      setDeactivateModal((prev) => ({ ...prev, error: 'Please specify a reason for deactivation.' }));
      return;
    }
    try {
      setDeactivateModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await workforceService.deactivateProfile(id, deactivateModal.reason);
      if (res.success) {
        showNotification(`${data.profile.first_name} has been deactivated.`);
        setDeactivateModal({ open: false, reason: '', submitting: false, error: null });
        fetchProfile();
      }
    } catch (err) {
      setDeactivateModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Deactivation failed.',
      }));
    }
  };

  const handleConfirmRestore = async () => {
    try {
      setRestoreModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await workforceService.restoreProfile(id, restoreModal.reason);
      if (res.success) {
        showNotification(`${data.profile.first_name} restored to active status.`);
        setRestoreModal({ open: false, reason: '', submitting: false, error: null });
        fetchProfile();
      }
    } catch (err) {
      setRestoreModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Restoration failed.',
      }));
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm(`Generate and email password reset link to ${data.profile.email}?`)) return;
    try {
      setActionLoading(true);
      const res = await workforceService.resetPassword(id);
      showNotification(res.message || `Password reset link sent to ${data.profile.email}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send password reset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async () => {
    try {
      setActionLoading(true);
      const res = await workforceService.resendInvitation(id);
      showNotification(res.message || `Invitation resent to ${data.profile.email}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend invitation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSafetyModal = async () => {
    setSafetyModal({
      open: true,
      loading: true,
      safetyData: null,
      action: 'ARCHIVE',
      confirmationCode: '',
      submitting: false,
      error: null,
    });

    try {
      const res = await workforceService.getDeletionSafety(id);
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
        error: err.response?.data?.message || 'Safety check check failed.',
      }));
    }
  };

  const handleConfirmArchiveDelete = async () => {
    const { action, confirmationCode } = safetyModal;
    const requiredCode = action === 'ARCHIVE' ? `ARCHIVE ${data.profile.workforce_code}` : `DELETE ${data.profile.workforce_code}`;

    if (confirmationCode.trim().toUpperCase() !== requiredCode) {
      setSafetyModal((prev) => ({ ...prev, error: `Please type "${requiredCode}" exactly to confirm.` }));
      return;
    }

    try {
      setSafetyModal((prev) => ({ ...prev, submitting: true, error: null }));
      if (action === 'ARCHIVE') {
        const res = await workforceService.archiveProfile(id, confirmationCode);
        showNotification(res.message || 'Profile successfully archived.');
        setSafetyModal({ open: false, loading: false, safetyData: null, action: 'ARCHIVE', confirmationCode: '', submitting: false, error: null });
        fetchProfile();
      } else {
        const res = await workforceService.permanentDeleteProfile(id, confirmationCode);
        showNotification(res.message || 'Profile permanently deleted.');
        navigate('/workforce/directory');
      }
    } catch (err) {
      setSafetyModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Action failed.',
      }));
    }
  };

  // Save Salary Structure
  const handleSaveSalary = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await workforceService.setSalaryStructure(id, salaryForm);
      setShowSalaryModal(false);
      showNotification('Salary structure updated successfully.');
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update salary');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Bank Account
  const handleSaveBank = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await workforceService.saveBankAccount(id, bankForm);
      setShowBankModal(false);
      showNotification('Bank details saved.');
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save bank details');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        Loading workforce member record...
      </div>
    );
  }

  if (!data || !data.profile) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#b91c1c' }}>
        {error || 'Member not found.'}
      </div>
    );
  }

  const { profile, employmentRecord, internshipRecord, bankAccount, salaryStructure, onboardingItems } = data;
  const isIntern = profile.workforce_type.includes('INTERN');

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'employment', label: isIntern ? 'Internship Details' : 'Employment & Contract' },
    { key: 'onboarding', label: `Onboarding (${onboardingItems?.length || 0})` },
    { key: 'cases', label: `Assigned Cases (${assignedCases?.length || 0})` },
    { key: 'attendance', label: 'Attendance History' },
    { key: 'leave', label: 'Leave Records' },
    { key: 'tasks', label: `Tasks (${tasksList?.length || 0})` },
    { key: 'documents', label: 'Documents' },
    { key: 'compensation', label: isIntern ? 'Stipend & Bank' : 'Salary & Bank' },
    { key: 'activity', label: 'Activity & Audit' },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
        <Link to="/workforce" style={{ color: '#3b82f6', textDecoration: 'none' }}>Workforce</Link>
        {' / '}
        <Link to="/workforce/directory" style={{ color: '#3b82f6', textDecoration: 'none' }}>Directory</Link>
        {' / '}
        <span style={{ color: '#0f172a', fontWeight: '600' }}>{profile.workforce_code}</span>
      </div>

      {actionMsg && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '500' }}>
          ✓ {actionMsg}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Profile Header Banner */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: '700',
              }}
            >
              {profile.first_name[0]}{profile.last_name ? profile.last_name[0] : ''}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  {profile.first_name} {profile.last_name}
                </h1>
                <WorkforceTypeBadge type={profile.workforce_type} />
                <WorkforceStatusBadge status={profile.status} />
              </div>
              <div style={{ fontSize: '14px', color: '#475569', marginBottom: '4px' }}>
                <strong>{profile.designation}</strong> • {profile.department}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Code: <strong>{profile.workforce_code}</strong> • Joined: {profile.joining_date} • Location: {profile.work_location}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              to={`/workforce/profiles/${id}/edit`}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ✏️ Edit Profile
            </Link>

            {profile.status !== 'ACTIVE' && (
              <button
                type="button"
                onClick={() => setActivateModal({ open: true, submitting: false, error: null })}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ✓ Activate Member
              </button>
            )}

            {profile.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => setDeactivateModal({ open: true, reason: '', submitting: false, error: null })}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ⏸ Deactivate
              </button>
            )}

            {['INACTIVE', 'SUSPENDED', 'EXITED'].includes(profile.status) && (
              <button
                type="button"
                onClick={() => setRestoreModal({ open: true, reason: '', submitting: false, error: null })}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#0369a1',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                ↺ Restore
              </button>
            )}

            <button
              type="button"
              onClick={handleResetPassword}
              disabled={actionLoading}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              🔑 Reset Password
            </button>

            <button
              type="button"
              onClick={handleResendInvitation}
              disabled={actionLoading}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              ✉ Resend Invite
            </button>

            <button
              type="button"
              onClick={handleOpenSafetyModal}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              🗑 Archive / Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto', gap: '4px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #0f172a' : '2px solid transparent',
              color: activeTab === tab.key ? '#0f172a' : '#64748b',
              fontWeight: activeTab === tab.key ? '600' : '500',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
              Personal & Contact Details
            </h3>
            <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              <div><strong>Full Name:</strong> {profile.first_name} {profile.last_name}</div>
              <div><strong>Primary Email:</strong> {profile.email}</div>
              <div><strong>User Account Email:</strong> {profile.user_email || 'Not provisioned'}</div>
              <div><strong>Account Status:</strong> <span style={{ fontWeight: '600', color: profile.user_status === 'ACTIVE' ? '#15803d' : '#b45309' }}>{profile.user_status || 'NONE'}</span></div>
              <div><strong>Primary Phone:</strong> {profile.phone}</div>
              <div><strong>Alternate Phone:</strong> {profile.alternate_phone || 'None'}</div>
              <div><strong>Work Location:</strong> {profile.work_location}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
              Chambers Role & Alignment
            </h3>
            <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              <div><strong>Workforce Code:</strong> {profile.workforce_code}</div>
              <div><strong>Designation:</strong> {profile.designation}</div>
              <div><strong>Practice Group:</strong> {profile.department}</div>
              <div><strong>Employment Mode:</strong> {profile.employment_mode}</div>
              <div><strong>Reporting Manager:</strong> {profile.manager_first_name ? `${profile.manager_first_name} ${profile.manager_last_name}` : 'Chambers Principal'}</div>
              <div><strong>Emergency Contact:</strong> {employmentRecord?.emergency_contact_name || 'Not provided'} ({employmentRecord?.emergency_contact_phone || 'N/A'})</div>
              <div><strong>Blood Group:</strong> {employmentRecord?.blood_group || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employment / Internship */}
      {activeTab === 'employment' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
              Contractual Terms & Periods
            </h3>
            <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              <div><strong>Joining Date:</strong> {profile.joining_date}</div>
              <div><strong>Expected End Date:</strong> {profile.expected_end_date || 'Permanent / Indefinite'}</div>
              <div><strong>Probation Period:</strong> {employmentRecord?.probation_period_days ? `${employmentRecord.probation_period_days} Days` : '90 Days'}</div>
              <div><strong>Notice Period:</strong> {employmentRecord?.notice_period_days ? `${employmentRecord.notice_period_days} Days` : '30 Days'}</div>
              <div><strong>Internal Notes:</strong> {profile.notes || 'No confidential notes recorded.'}</div>
            </div>
          </div>

          {isIntern && internshipRecord && (
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
                Law College & Internship Record
              </h3>
              <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                <div><strong>College / Institution:</strong> {internshipRecord.college_institution}</div>
                <div><strong>Course & Academic Year:</strong> {internshipRecord.course} {internshipRecord.academic_year || ''}</div>
                <div><strong>Internship Tenure:</strong> {internshipRecord.start_date} to {internshipRecord.planned_end_date}</div>
                <div>
                  <strong>Stipend Policy:</strong>{' '}
                  {internshipRecord.stipend_enabled ? (
                    <span style={{ color: '#047857', fontWeight: '600' }}>₹{internshipRecord.stipend_amount} / {internshipRecord.stipend_frequency}</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>Unpaid Academic Internship</span>
                  )}
                </div>
                <div><strong>Certificate Status:</strong> {internshipRecord.certificate_status} {internshipRecord.certificate_number ? `(${internshipRecord.certificate_number})` : ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Onboarding Checklist */}
      {activeTab === 'onboarding' && (
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Onboarding Checklist & Readiness
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {onboardingItems?.filter((i) => i.status === 'COMPLETED').length} of {onboardingItems?.length || 0} completed
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {onboardingItems?.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: item.status === 'COMPLETED' ? '#f0fdf4' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={item.status === 'COMPLETED'}
                    onChange={() => handleToggleChecklist(item.id, item.status)}
                    disabled={actionLoading}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Category: {item.category} {item.mandatory && '• Mandatory'}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: item.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7',
                    color: item.status === 'COMPLETED' ? '#166534' : '#92400e',
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Assigned Cases */}
      {activeTab === 'cases' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Active Case Assignments ({assignedCases.length})
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Case Number</th>
                <th style={{ padding: '12px 16px' }}>Case Title</th>
                <th style={{ padding: '12px 16px' }}>Role in Case</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tabLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading case assignments...
                  </td>
                </tr>
              ) : assignedCases.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No active legal cases assigned to this member.
                  </td>
                </tr>
              ) : (
                assignedCases.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <Link to={`/cases/${c.case_id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {c.case_number}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{c.case_title}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>{c.role || 'Associate Counsel'}</td>
                    <td style={{ padding: '12px 16px' }}>{c.case_type || 'Litigation'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#334155' }}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Attendance History */}
      {activeTab === 'attendance' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Attendance Logs & Punch Times
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px' }}>Punch In</th>
                <th style={{ padding: '12px 16px' }}>Punch Out</th>
                <th style={{ padding: '12px 16px' }}>Total Hours</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Regularized</th>
              </tr>
            </thead>
            <tbody>
              {tabLoading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading attendance records...
                  </td>
                </tr>
              ) : attendanceLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No attendance records logged for this member yet.
                  </td>
                </tr>
              ) : (
                attendanceLogs.map((att) => (
                  <tr key={att.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{att.date}</td>
                    <td style={{ padding: '12px 16px' }}>{att.check_in_time || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{att.check_out_time || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{att.hours_worked ? `${att.hours_worked} hrs` : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', backgroundColor: att.status === 'PRESENT' ? '#dcfce7' : '#fee2e2', color: att.status === 'PRESENT' ? '#166534' : '#991b1b' }}>
                        {att.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{att.is_regularized ? '✓ Yes' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 6: Leave Records */}
      {activeTab === 'leave' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Balances */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
              Leave Balances
            </h3>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {leaveRecords.balances.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>No leave quota assigned.</div>
              ) : (
                leaveRecords.balances.map((b) => (
                  <div key={b.id} style={{ backgroundColor: '#f8fafc', padding: '12px 18px', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '140px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{b.leave_type_name}</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{b.remaining_days} days left</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Past Requests */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Leave Requests & History
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Leave Type</th>
                  <th style={{ padding: '12px 16px' }}>From</th>
                  <th style={{ padding: '12px 16px' }}>To</th>
                  <th style={{ padding: '12px 16px' }}>Days</th>
                  <th style={{ padding: '12px 16px' }}>Reason</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRecords.requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      No leave requests filed.
                    </td>
                  </tr>
                ) : (
                  leaveRecords.requests.map((lr) => (
                    <tr key={lr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>{lr.leave_type_name}</td>
                      <td style={{ padding: '12px 16px' }}>{lr.start_date}</td>
                      <td style={{ padding: '12px 16px' }}>{lr.end_date}</td>
                      <td style={{ padding: '12px 16px' }}>{lr.total_days}</td>
                      <td style={{ padding: '12px 16px' }}>{lr.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', backgroundColor: lr.status === 'APPROVED' ? '#dcfce7' : lr.status === 'REJECTED' ? '#fee2e2' : '#fef3c7', color: lr.status === 'APPROVED' ? '#166534' : lr.status === 'REJECTED' ? '#991b1b' : '#92400e' }}>
                          {lr.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Tasks */}
      {activeTab === 'tasks' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Tasks & Deliverables ({tasksList.length})
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Code</th>
                <th style={{ padding: '12px 16px' }}>Title</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Priority</th>
                <th style={{ padding: '12px 16px' }}>Due Date</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasksList.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No tasks assigned to this member.
                  </td>
                </tr>
              ) : (
                tasksList.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{t.task_code}</td>
                    <td style={{ padding: '12px 16px' }}>{t.title}</td>
                    <td style={{ padding: '12px 16px' }}>{t.task_type}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: t.priority === 'HIGH' ? '#dc2626' : '#475569' }}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{t.due_date || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', backgroundColor: t.status === 'COMPLETED' ? '#dcfce7' : '#f1f5f9', color: t.status === 'COMPLETED' ? '#166534' : '#334155' }}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 8: Documents */}
      {activeTab === 'documents' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Documents & Compliance Records
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Document Title</th>
                <th style={{ padding: '12px 16px' }}>Type / Category</th>
                <th style={{ padding: '12px 16px' }}>File Name</th>
                <th style={{ padding: '12px 16px' }}>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {documentsList.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No compliance documents uploaded for this member.
                  </td>
                </tr>
              ) : (
                documentsList.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{doc.title || doc.file_name}</td>
                    <td style={{ padding: '12px 16px' }}>{doc.document_type || 'VERIFICATION'}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{doc.file_name}</td>
                    <td style={{ padding: '12px 16px' }}>{doc.created_at ? doc.created_at.slice(0, 10) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 9: Compensation & Bank */}
      {activeTab === 'compensation' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                {isIntern ? 'Stipend Package' : 'Salary Structure'}
              </h3>
              {!isIntern && (
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(true)}
                  style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}
                >
                  Configure
                </button>
              )}
            </div>

            {isIntern ? (
              <div style={{ fontSize: '13px', display: 'grid', gap: '10px' }}>
                <div><strong>Stipend Policy:</strong> {internshipRecord?.stipend_enabled ? 'Paid Internship' : 'Unpaid Academic'}</div>
                <div><strong>Monthly Stipend:</strong> ₹{internshipRecord?.stipend_amount || 0}</div>
              </div>
            ) : salaryStructure ? (
              <div style={{ fontSize: '13px', display: 'grid', gap: '8px' }}>
                <div><strong>Gross Monthly:</strong> ₹{salaryStructure.gross_amount}</div>
                <div><strong>Basic Pay:</strong> ₹{salaryStructure.basic_amount}</div>
                <div><strong>Allowances:</strong> ₹{salaryStructure.allowances_amount}</div>
                <div><strong>Deductions:</strong> ₹{salaryStructure.deductions_amount}</div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontWeight: '700' }}>
                  Net Monthly: ₹{salaryStructure.gross_amount - salaryStructure.deductions_amount}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#64748b' }}>No salary structure configured.</div>
            )}
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Bank Account Details
              </h3>
              <button
                type="button"
                onClick={() => setShowBankModal(true)}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}
              >
                {bankAccount ? 'Update Bank' : '+ Add Bank'}
              </button>
            </div>

            {bankAccount ? (
              <div style={{ fontSize: '13px', display: 'grid', gap: '8px' }}>
                <div><strong>Bank Name:</strong> {bankAccount.bank_name}</div>
                <div><strong>Account Holder:</strong> {bankAccount.account_holder_name}</div>
                <div><strong>Masked Account:</strong> {bankAccount.account_number_masked}</div>
                <div><strong>IFSC:</strong> {bankAccount.ifsc_masked}</div>
                <div><strong>UPI ID:</strong> {bankAccount.upi_id || 'None'}</div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#64748b' }}>No bank account on record for disbursements.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 10: Activity & Audit Trail */}
      {activeTab === 'activity' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Chronological Audit Trail & Profile Events
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px' }}>Action</th>
                <th style={{ padding: '12px 16px' }}>Actor</th>
                <th style={{ padding: '12px 16px' }}>IP / Agent</th>
                <th style={{ padding: '12px 16px' }}>Details / Reason</th>
              </tr>
            </thead>
            <tbody>
              {tabLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : activityLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No audit events recorded for this workforce member.
                  </td>
                </tr>
              ) : (
                activityLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {log.actor_name || `User #${log.user_id}`}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {log.ip_address || 'Internal'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Activate Member Modal */}
      {activateModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>Activate Workforce Member</h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Activate <strong>{profile.first_name} {profile.last_name}</strong> ({profile.workforce_code}). This will enable user login credentials.
            </p>

            {activateModal.error && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                {activateModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setActivateModal({ open: false, submitting: false, error: null })} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleConfirmActivate} disabled={activateModal.submitting} style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: '#15803d', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                {activateModal.submitting ? 'Activating...' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Member Modal */}
      {deactivateModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>Deactivate Workforce Member</h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Deactivating this profile revokes all active login sessions. Existing legal case records remain preserved.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Reason for Deactivation *</label>
              <textarea rows="3" value={deactivateModal.reason} onChange={(e) => setDeactivateModal({ ...deactivateModal, reason: e.target.value })} placeholder="Operational or administrative reason..." style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>

            {deactivateModal.error && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                {deactivateModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setDeactivateModal({ open: false, reason: '', submitting: false, error: null })} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleConfirmDeactivate} disabled={deactivateModal.submitting} style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: '#d97706', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                {deactivateModal.submitting ? 'Deactivating...' : 'Deactivate Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Member Modal */}
      {restoreModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>Restore Workforce Member</h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Reactivate <strong>{profile.first_name} {profile.last_name}</strong> to ACTIVE status.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Restoration Notes (Optional)</label>
              <textarea rows="2" value={restoreModal.reason} onChange={(e) => setRestoreModal({ ...restoreModal, reason: e.target.value })} placeholder="e.g. Return from leave..." style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>

            {restoreModal.error && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                {restoreModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setRestoreModal({ open: false, reason: '', submitting: false, error: null })} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleConfirmRestore} disabled={restoreModal.submitting} style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: '#0369a1', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                {restoreModal.submitting ? 'Restoring...' : 'Restore to Active'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Check & Archive/Delete Modal */}
      {safetyModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '540px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>Deletion Safety Check</h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Target: <strong>{profile.first_name} {profile.last_name}</strong> ({profile.workforce_code})
            </p>

            {safetyModal.loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Analyzing database dependencies...</div>
            ) : safetyModal.safetyData ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Cases</div>
                    <div style={{ fontSize: '15px', fontWeight: '700' }}>{safetyModal.safetyData.counts.assignedCases}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Documents</div>
                    <div style={{ fontSize: '15px', fontWeight: '700' }}>{safetyModal.safetyData.counts.documents}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Attendance</div>
                    <div style={{ fontSize: '15px', fontWeight: '700' }}>{safetyModal.safetyData.counts.attendance}</div>
                  </div>
                </div>

                {!safetyModal.safetyData.canPermanentlyDelete && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
                    ⛔ <strong>Permanent Deletion Blocked:</strong> Historical legal or attendance records exist. Archiving is required to preserve compliance audit logs.
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                    Type <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>
                      {safetyModal.action === 'ARCHIVE' ? `ARCHIVE ${profile.workforce_code}` : `DELETE ${profile.workforce_code}`}
                    </code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={safetyModal.confirmationCode}
                    onChange={(e) => setSafetyModal({ ...safetyModal, confirmationCode: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            ) : null}

            {safetyModal.error && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                {safetyModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setSafetyModal({ open: false, loading: false, safetyData: null, action: 'ARCHIVE', confirmationCode: '', submitting: false, error: null })} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer' }}>Cancel</button>
              <button
                type="button"
                onClick={handleConfirmArchiveDelete}
                disabled={safetyModal.submitting || safetyModal.confirmationCode.trim().toUpperCase() !== (safetyModal.action === 'ARCHIVE' ? `ARCHIVE ${profile.workforce_code}` : `DELETE ${profile.workforce_code}`)}
                style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: '#475569', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}
              >
                {safetyModal.submitting ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Structure Modal */}
      {showSalaryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Configure Salary Structure</h2>
            <form onSubmit={handleSaveSalary} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Gross Monthly (₹)</label>
                <input type="number" required value={salaryForm.gross_amount} onChange={(e) => setSalaryForm({ ...salaryForm, gross_amount: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Basic Pay (₹)</label>
                <input type="number" required value={salaryForm.basic_amount} onChange={(e) => setSalaryForm({ ...salaryForm, basic_amount: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Allowances (₹)</label>
                <input type="number" value={salaryForm.allowances_amount} onChange={(e) => setSalaryForm({ ...salaryForm, allowances_amount: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Deductions (₹)</label>
                <input type="number" value={salaryForm.deductions_amount} onChange={(e) => setSalaryForm({ ...salaryForm, deductions_amount: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowSalaryModal(false)} style={{ padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={{ padding: '8px 16px', borderRadius: '6px', background: '#0f172a', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Save Structure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Account Modal */}
      {showBankModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Bank Account Details</h2>
            <form onSubmit={handleSaveBank} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Account Holder Name</label>
                <input type="text" required value={bankForm.account_holder_name} onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Bank Name</label>
                <input type="text" required value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Account Number</label>
                <input type="text" required value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>IFSC Code</label>
                <input type="text" required value={bankForm.ifsc} onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>UPI ID (Optional)</label>
                <input type="text" value={bankForm.upi_id} onChange={(e) => setBankForm({ ...bankForm, upi_id: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowBankModal(false)} style={{ padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={{ padding: '8px 16px', borderRadius: '6px', background: '#0f172a', color: '#ffffff', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Save Bank</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceDetailPage;
