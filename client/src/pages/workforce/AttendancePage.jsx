import React, { useState, useEffect } from 'react';
import { workforceService } from '../../services/workforceService';
import { useAuth } from '../../context/AuthContext';
import { IconClock, IconSearch, IconClose } from '../../components/common/Icons';

const AttendancePage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Regularize modal
  const [showRegModal, setShowRegModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [regForm, setRegForm] = useState({ check_in: '', check_out: '', reason: '', status: 'PRESENT' });
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await workforceService.getAttendanceLogs({
        date_from: dateFrom,
        date_to: dateTo,
        status: statusFilter,
        limit: 50,
      });
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch attendance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleRegularizeSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await workforceService.regularizeAttendance(selectedLog.id, regForm);
      setShowRegModal(false);
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regularize attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PRESENT': return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
      case 'LATE': return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
      case 'HALF_DAY': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'LEAVE': return { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' };
      case 'WORK_FROM_HOME': return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
      case 'ABSENT': return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
      default: return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
            Chambers Attendance & Punctuality Logs
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Daily punch logs, shift grace rules (09:30 AM + 15m), and hours calculation.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '2px' }}>From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '2px' }}>To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '2px' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="WORK_FROM_HOME">Work From Home</option>
              <option value="LEAVE">Leave</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button
              type="submit"
              style={{
                padding: '9px 18px',
                borderRadius: '6px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px' }}>Member</th>
                <th style={{ padding: '12px 16px' }}>Check-in</th>
                <th style={{ padding: '12px 16px' }}>Check-out</th>
                <th style={{ padding: '12px 16px' }}>Total Hours</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Source</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading attendance logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No attendance records found for the selected period.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const sc = getStatusColor(log.status);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {log.attendance_date}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>
                          {log.first_name} {log.last_name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {log.workforce_code} • {log.designation}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{log.check_in || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{log.check_out || '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                        {log.total_hours > 0 ? `${log.total_hours} hrs` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: sc.bg,
                            color: sc.color,
                            border: `1px solid ${sc.border}`,
                          }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                        {log.source}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setRegForm({
                              check_in: log.check_in || '09:30:00',
                              check_out: log.check_out || '18:30:00',
                              reason: '',
                              status: log.status,
                            });
                            setShowRegModal(true);
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: 'pointer',
                          }}
                        >
                          Regularize
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regularize Modal */}
      {showRegModal && selectedLog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '420px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
              Regularize Attendance ({selectedLog.attendance_date})
            </h3>
            <form onSubmit={handleRegularizeSubmit}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Check-in Time</label>
                <input
                  type="time"
                  step="1"
                  required
                  value={regForm.check_in}
                  onChange={(e) => setRegForm({ ...regForm, check_in: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Check-out Time</label>
                <input
                  type="time"
                  step="1"
                  required
                  value={regForm.check_out}
                  onChange={(e) => setRegForm({ ...regForm, check_out: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Attendance Status</label>
                <select
                  value={regForm.status}
                  onChange={(e) => setRegForm({ ...regForm, status: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="PRESENT">Present</option>
                  <option value="WORK_FROM_HOME">Work From Home (Court Filing / Research)</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LATE">Late Regularized</option>
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Reason for Regularization *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Attended High Court hearing first thing in morning."
                  value={regForm.reason}
                  onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowRegModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: '600' }}>Save Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
