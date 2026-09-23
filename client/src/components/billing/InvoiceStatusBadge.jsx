import React from 'react';

const statusConfig = {
  DRAFT: { label: 'Draft', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  ISSUED: { label: 'Issued', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  SENT: { label: 'Sent', bg: '#f0fdf4', color: '#047857', border: '#bbf7d0' },
  PARTIALLY_PAID: { label: 'Partially Paid', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  PAID: { label: 'Paid in Full', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  OVERDUE: { label: 'Overdue', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  CANCELLED: { label: 'Cancelled', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  VOID: { label: 'Voided', bg: '#fff1f2', color: '#9f1239', border: '#fecdd3' },
};

export const InvoiceStatusBadge = ({ status }) => {
  const config = statusConfig[status] || {
    label: status || 'Unknown',
    bg: '#f3f4f6',
    color: '#374151',
    border: '#d1d5db'
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        letterSpacing: '0.025em',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          marginRight: '6px'
        }}
      />
      {config.label}
    </span>
  );
};

export default InvoiceStatusBadge;
