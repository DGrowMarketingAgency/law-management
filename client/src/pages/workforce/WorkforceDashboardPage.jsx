import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workforceService } from '../../services/workforceService';
import { useAuth } from '../../context/AuthContext';
import {
  IconUsers,
  IconBriefcase,
  IconClock,
  IconAward,
  IconCheckSquare,
  IconPayment,
  IconTarget,
} from '../../components/common/Icons';

const WorkforceDashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchStatus, setPunchStatus] = useState(null);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await workforceService.getDashboardStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load workforce statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleQuickCheckIn = async () => {
    try {
      setPunchLoading(true);
      setError(null);
      // Punch for current user's workforce ID if available, or ask
      const dir = await workforceService.getDirectory({ limit: 1 });
      const myProfile = dir.profiles?.find((p) => p.user_id === user?.id) || dir.profiles?.[0];
      if (!myProfile) {
        setError('No active workforce profile found for current user.');
        return;
      }
      const res = await workforceService.checkIn(myProfile.id, { source: 'WEB' });
      setPunchStatus(`Check-in recorded at ${res.data.check_in} (${res.data.status})`);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed');
    } finally {
      setPunchLoading(false);
    }
  };

  const handleQuickCheckOut = async () => {
    try {
      setPunchLoading(true);
      setError(null);
      const dir = await workforceService.getDirectory({ limit: 1 });
      const myProfile = dir.profiles?.find((p) => p.user_id === user?.id) || dir.profiles?.[0];
      if (!myProfile) {
        setError('No active workforce profile found for current user.');
        return;
      }
      const res = await workforceService.checkOut(myProfile.id);
      setPunchStatus(`Check-out recorded at ${res.data.check_out} (${res.data.total_hours} hrs logged)`);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Check-out failed');
    } finally {
      setPunchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading Chambers workforce dashboard...</p>
      </div>
    );
  }

  const wf = stats?.workforce || {};
  const att = stats?.attendance_today || {};

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
            Workforce & Internship Command Center
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Comprehensive lifecycle management for Advocates, Legal Associates, Interns, and Support Staff.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            to="/workforce/directory"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '13px',
            }}
          >
            <IconUsers size={16} />
            Members Directory
          </Link>
          <Link
            to="/workforce/candidates"
            className="btn btn-outline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              color: '#334155',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '13px',
              backgroundColor: '#ffffff',
            }}
          >
            <IconTarget size={16} />
            Recruitment Pipeline
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {punchStatus && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {punchStatus}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Total Workforce */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Active Members</span>
            <div style={{ padding: '6px', backgroundColor: '#eff6ff', borderRadius: '6px', color: '#1d4ed8' }}>
              <IconUsers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{wf.active_members || 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Total Registered: {wf.total_workforce || 0}
          </div>
        </div>

        {/* Employees */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Full-time Associates</span>
            <div style={{ padding: '6px', backgroundColor: '#ecfdf5', borderRadius: '6px', color: '#047857' }}>
              <IconBriefcase size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#047857' }}>{wf.active_employees || 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            On Notice: {wf.on_notice_count || 0}
          </div>
        </div>

        {/* Legal Interns */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Legal Interns</span>
            <div style={{ padding: '6px', backgroundColor: '#fef3c7', borderRadius: '6px', color: '#b45309' }}>
              <IconAward size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#b45309' }}>
            {(wf.active_paid_interns || 0) + (wf.active_unpaid_interns || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {wf.active_paid_interns || 0} Paid • {wf.active_unpaid_interns || 0} Academic Unpaid
          </div>
        </div>

        {/* Today's Attendance */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Today's Presence</span>
            <div style={{ padding: '6px', backgroundColor: '#f5f3ff', borderRadius: '6px', color: '#7c3aed' }}>
              <IconClock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{att.present_count || 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {att.late_count || 0} Late • {att.wfh_count || 0} WFH • {att.leave_count || 0} Leave
          </div>
        </div>

        {/* Open Tasks */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Pending Tasks & Leaves</span>
            <div style={{ padding: '6px', backgroundColor: '#fff7ed', borderRadius: '6px', color: '#c2410c' }}>
              <IconCheckSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#c2410c' }}>{stats?.open_tasks || 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {stats?.pending_leaves || 0} Leave Approval(s) Pending
          </div>
        </div>
      </div>

      {/* Chambers Action Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Daily Punch Terminal */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Daily Chambers Punch Terminal
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Chambers Schedule: <strong>09:30 AM – 06:30 PM</strong> with 15-min grace period. Total hours computed automatically.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleQuickCheckIn}
              disabled={punchLoading}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {punchLoading ? 'Logging...' : 'Punch In (Check-in)'}
            </button>
            <button
              onClick={handleQuickCheckOut}
              disabled={punchLoading}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {punchLoading ? 'Logging...' : 'Punch Out (Check-out)'}
            </button>
            <Link
              to="/workforce/attendance"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                color: '#475569',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              View Roster
            </Link>
          </div>
        </div>

        {/* Quick Modules Navigation */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Operations & Governance
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Link
              to="/workforce/leaves"
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '500',
                display: 'block',
              }}
            >
              📋 Leaves ({stats?.pending_leaves || 0} Pending)
            </Link>
            <Link
              to="/workforce/tasks"
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '500',
                display: 'block',
              }}
            >
              ⚖️ Tasks ({stats?.open_tasks || 0} Active)
            </Link>
            <Link
              to="/workforce/payroll"
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '500',
                display: 'block',
              }}
            >
              💰 Payroll & Stipends
            </Link>
            <Link
              to="/workforce/assets"
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '500',
                display: 'block',
              }}
            >
              💻 Chamber Assets
            </Link>
            <Link
              to="/workforce/offboarding"
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '500',
                display: 'block',
              }}
            >
              🚪 Exit & Handover
            </Link>
            <Link
              to="/workforce/candidates"
              style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '500',
                display: 'block',
              }}
            >
              🎯 Candidate Pipeline ({stats?.active_candidates || 0})
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkforceDashboardPage;
