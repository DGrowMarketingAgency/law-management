import React, { useState, useEffect } from 'react';
import workforceService from '../../services/workforceService';
import { WorkforceStatusBadge, WorkforceTypeBadge } from '../../components/workforce/WorkforceBadges';
import {
  UserMinus,
  Award,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  ArrowRight,
  Briefcase,
  FileText,
  Clock,
  Key
} from '../../components/common/Icons';

export default function OffboardingPage() {
  const [members, setMembers] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [offboardingDetails, setOffboardingDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Forms
  const [initiateForm, setInitiateForm] = useState({
    workforce_id: '',
    exit_type: 'RESIGNATION',
    notice_date: new Date().toISOString().split('T')[0],
    last_working_date: '',
    reason: ''
  });

  const [handoverForm, setHandoverForm] = useState({
    item_type: 'CASE',
    item_title: '',
    handed_over_to_workforce_id: '',
    notes: ''
  });

  useEffect(() => {
    loadMembers();
  }, [statusFilter]);

  const loadMembers = async () => {
    setLoading(true);
    setError('');
    try {
      // Load offboarding / exited / all members
      const params = { limit: 100 };
      if (statusFilter) {
        params.status = statusFilter;
      }
      const res = await workforceService.getDirectory(params);
      const allList = res.data || [];
      setMembers(allList);

      // Extract active members for dropdown
      const actives = allList.filter(m => m.status === 'ACTIVE' || m.status === 'ONBOARDING');
      setActiveMembers(actives);
    } catch (err) {
      console.error('Failed to load members for offboarding:', err);
      setError(err.response?.data?.message || 'Failed to load offboarding records.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
    setDetailsLoading(true);
    try {
      const res = await workforceService.getOffboardingDetails(member.id);
      setOffboardingDetails(res.data);
    } catch (err) {
      console.error('Failed to load offboarding details:', err);
      setError(err.response?.data?.message || 'Failed to fetch offboarding data.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleInitiateExit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await workforceService.submitExitRequest(parseInt(initiateForm.workforce_id), {
        exit_type: initiateForm.exit_type,
        notice_date: initiateForm.notice_date,
        last_working_date: initiateForm.last_working_date,
        reason: initiateForm.reason
      });
      setSuccessMsg('Exit request initiated successfully.');
      setShowInitiateModal(false);
      setInitiateForm({
        workforce_id: '',
        exit_type: 'RESIGNATION',
        notice_date: new Date().toISOString().split('T')[0],
        last_working_date: '',
        reason: ''
      });
      loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate exit request.');
    }
  };

  const handleToggleChecklist = async (itemId, currentCompleted) => {
    try {
      await workforceService.updateOffboardingChecklistItem(itemId, {
        is_completed: !currentCompleted
      });
      // Refresh details
      const res = await workforceService.getOffboardingDetails(selectedMember.id);
      setOffboardingDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update checklist item.');
    }
  };

  const handleAddHandover = async (e) => {
    e.preventDefault();
    try {
      await workforceService.createHandoverItem(selectedMember.id, {
        item_type: handoverForm.item_type,
        item_title: handoverForm.item_title,
        handed_over_to_workforce_id: handoverForm.handed_over_to_workforce_id ? parseInt(handoverForm.handed_over_to_workforce_id) : null,
        notes: handoverForm.notes
      });
      setSuccessMsg('Handover item registered.');
      setHandoverForm({
        item_type: 'CASE',
        item_title: '',
        handed_over_to_workforce_id: '',
        notes: ''
      });
      const res = await workforceService.getOffboardingDetails(selectedMember.id);
      setOffboardingDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add handover item.');
    }
  };

  const handleIssueCertificate = async () => {
    if (!window.confirm(`Issue Internship Completion Certificate for ${selectedMember.first_name} ${selectedMember.last_name}?`)) {
      return;
    }
    try {
      const res = await workforceService.issueInternshipCertificate(selectedMember.id);
      setSuccessMsg(`Certificate generated successfully! Code: ${res.data?.certificate_code}`);
      const refreshed = await workforceService.getOffboardingDetails(selectedMember.id);
      setOffboardingDetails(refreshed.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate certificate.');
    }
  };

  const handleExecuteFullRevocation = async () => {
    if (!window.confirm(`CRITICAL: This will inactivate login accounts, revoke refresh tokens, unassign active court cases, and transition ${selectedMember.first_name} to ALUMNI/EXITED. Proceed?`)) {
      return;
    }
    try {
      await workforceService.executeFullRevocation(selectedMember.id);
      setSuccessMsg('Full access revocation and alumni transition completed successfully!');
      setShowDetailModal(false);
      setSelectedMember(null);
      loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to execute revocation.');
    }
  };

  // Filtered members list
  const filteredMembers = members.filter((m) => {
    const isExiting = ['EXIT_INITIATED', 'OFFBOARDING', 'ALUMNI', 'TERMINATED'].includes(m.status);
    if (!statusFilter && !isExiting) return false;

    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (m.first_name && m.first_name.toLowerCase().includes(term)) ||
      (m.last_name && m.last_name.toLowerCase().includes(term)) ||
      (m.workforce_code && m.workforce_code.toLowerCase().includes(term)) ||
      (m.email && m.email.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            Workforce Offboarding & Alumni
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Formal resignation/exit workflows, handovers, internship completion certificates, and access revocation.
          </p>
        </div>

        <button
          onClick={() => setShowInitiateModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <UserMinus size={16} />
          Initiate Member Exit
        </button>
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

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by name, code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff' }}
        >
          <option value="">All Exiting & Alumni</option>
          <option value="EXIT_INITIATED">Exit Initiated</option>
          <option value="OFFBOARDING">Offboarding in Progress</option>
          <option value="ALUMNI">Alumni / Completed</option>
          <option value="TERMINATED">Terminated</option>
        </select>

        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); }}
            style={{ fontSize: '13px', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          Loading offboarding records...
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Member</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Role & Type</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Designation</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No members currently in exit or alumni status.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>
                        {m.first_name} {m.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{m.email}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <WorkforceTypeBadge type={m.workforce_type} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{m.workforce_code}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {m.designation || 'Chambers Member'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <WorkforceStatusBadge status={m.status} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => handleOpenDetails(m)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          backgroundColor: '#1e293b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Manage Exit & Revocation
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Initiate Exit */}
      {showInitiateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0' }}>
              Initiate Workforce Exit Workflow
            </h2>

            <form onSubmit={handleInitiateExit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Member *
                </label>
                <select
                  required
                  value={initiateForm.workforce_id}
                  onChange={(e) => setInitiateForm({ ...initiateForm, workforce_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="">-- Choose Active Member --</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.workforce_code} - {m.workforce_type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Exit Type *
                  </label>
                  <select
                    required
                    value={initiateForm.exit_type}
                    onChange={(e) => setInitiateForm({ ...initiateForm, exit_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="RESIGNATION">Resignation</option>
                    <option value="INTERNSHIP_COMPLETION">Internship Completion</option>
                    <option value="CONTRACT_EXPIRY">Contract Expiry</option>
                    <option value="TERMINATION">Chambers Termination</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Notice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={initiateForm.notice_date}
                    onChange={(e) => setInitiateForm({ ...initiateForm, notice_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Last Working Date *
                </label>
                <input
                  type="date"
                  required
                  value={initiateForm.last_working_date}
                  onChange={(e) => setInitiateForm({ ...initiateForm, last_working_date: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Reason / Notes
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g., Higher studies LLM admission / Contract completion"
                  value={initiateForm.reason}
                  onChange={(e) => setInitiateForm({ ...initiateForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowInitiateModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Initiate Exit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Offboarding Details & Revocation */}
      {showDetailModal && selectedMember && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
                  Offboarding: {selectedMember.first_name} {selectedMember.last_name}
                </h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <WorkforceTypeBadge type={selectedMember.workforce_type} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedMember.workforce_code}</span>
                  <WorkforceStatusBadge status={selectedMember.status} />
                </div>
              </div>
              <button
                onClick={() => { setShowDetailModal(false); setSelectedMember(null); }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                Loading offboarding records...
              </div>
            ) : (
              <div>
                {/* Certificate Section for Interns */}
                {(selectedMember.workforce_type === 'PAID_INTERN' || selectedMember.workforce_type === 'UNPAID_INTERN') && (
                  <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Award size={18} />
                          Internship Completion Certificate
                        </div>
                        <div style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
                          {offboardingDetails?.certificate ? (
                            <span>Certificate Issued! Code: <strong>{offboardingDetails.certificate.certificate_code}</strong></span>
                          ) : (
                            <span>Generate official certificate with verification code for this intern.</span>
                          )}
                        </div>
                      </div>

                      {!offboardingDetails?.certificate && (
                        <button
                          onClick={handleIssueCertificate}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Generate Certificate
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Checklist */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                    Offboarding Clearance Checklist
                  </h3>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {offboardingDetails?.checklist?.length === 0 ? (
                      <div style={{ padding: '16px', color: '#94a3b8', textAlign: 'center' }}>
                        No checklist items initialized.
                      </div>
                    ) : (
                      offboardingDetails?.checklist?.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleChecklist(item.id, item.is_completed)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor: item.is_completed ? '#f8fafc' : '#fff'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!item.is_completed}
                            onChange={() => {}}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: item.is_completed ? '#64748b' : '#0f172a', textDecoration: item.is_completed ? 'line-through' : 'none' }}>
                              {item.title}
                            </div>
                            {item.description && (
                              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{item.description}</div>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                            {item.category}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Handovers */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                    Court Case & Chambers Handover
                  </h3>

                  <form onSubmit={handleAddHandover} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
                    <select
                      value={handoverForm.item_type}
                      onChange={(e) => setHandoverForm({ ...handoverForm, item_type: e.target.value })}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="CASE">Case</option>
                      <option value="TASK">Task</option>
                      <option value="DOCUMENT">Document</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Title / Case Description..."
                      value={handoverForm.item_title}
                      onChange={(e) => setHandoverForm({ ...handoverForm, item_title: e.target.value })}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <select
                      value={handoverForm.handed_over_to_workforce_id}
                      onChange={(e) => setHandoverForm({ ...handoverForm, handed_over_to_workforce_id: e.target.value })}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="">-- Successor --</option>
                      {activeMembers.filter(m => m.id !== selectedMember.id).map(m => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      style={{ padding: '6px 12px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </form>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {offboardingDetails?.handovers?.length === 0 ? (
                      <div style={{ padding: '14px', color: '#94a3b8', textAlign: 'center', fontSize: '13px' }}>
                        No handover tasks recorded yet.
                      </div>
                    ) : (
                      offboardingDetails?.handovers?.map((h) => (
                        <div key={h.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>
                              {h.item_type}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>{h.item_title}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Successor: {h.successor_name || 'Unassigned'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Revocation Trigger Section */}
                <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={18} />
                      Full Access Revocation & Alumni Transition
                    </div>
                    <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
                      Deactivates user account, terminates active login tokens, unassigns court cases, and moves to Alumni.
                    </div>
                  </div>

                  {selectedMember.status !== 'ALUMNI' && selectedMember.status !== 'TERMINATED' ? (
                    <button
                      onClick={handleExecuteFullRevocation}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(220,38,38,0.2)'
                      }}
                    >
                      Execute Revocation
                    </button>
                  ) : (
                    <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '600' }}>
                      Access Already Revoked
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
