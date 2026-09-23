import React from 'react';

export const WorkforceTypeBadge = ({ type }) => {
  const styles = {
    EMPLOYEE: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', label: 'Employee' },
    PAID_INTERN: { bg: '#fef3c7', color: '#b45309', border: '#fde68a', label: 'Paid Intern' },
    UNPAID_INTERN: { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb', label: 'Unpaid Intern' },
    CONTRACTOR: { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff', label: 'Contractor' },
  };

  const conf = styles[type] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: type };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        backgroundColor: conf.bg,
        color: conf.color,
        border: `1px solid ${conf.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
      }}
    >
      {conf.label}
    </span>
  );
};

export const WorkforceStatusBadge = ({ status }) => {
  const styles = {
    ACTIVE: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    ONBOARDING: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    ON_NOTICE: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    SUSPENDED: { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
    EXITED: { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
    COMPLETED: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    TERMINATED: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    DRAFT: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  };

  const conf = styles[status] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        backgroundColor: conf.bg,
        color: conf.color,
        border: `1px solid ${conf.border}`,
      }}
    >
      {status ? status.replace(/_/g, ' ') : 'UNKNOWN'}
    </span>
  );
};
