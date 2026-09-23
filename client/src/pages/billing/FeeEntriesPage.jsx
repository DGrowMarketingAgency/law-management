import React, { useState, useEffect } from 'react';
import feeEntryService from '../../services/feeEntryService';
import FeeEntryModal from '../../components/billing/FeeEntryModal';
import { IconHourglass } from '../../components/common/Icons';

export const FeeEntriesPage = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [unbilledOnly, setUnbilledOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    fetchEntries();
  }, [unbilledOnly, typeFilter]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = {};
      if (unbilledOnly) params.is_billed = 'false';
      if (typeFilter) params.entry_type = typeFilter;

      const res = await feeEntryService.getFeeEntries(params);
      setEntries(res.data?.items || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load fee entries');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this billable entry?')) return;
    try {
      await feeEntryService.deleteFeeEntry(id);
      fetchEntries();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete entry');
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.description?.toLowerCase().includes(q) ||
      e.client_name?.toLowerCase().includes(q) ||
      e.case_title?.toLowerCase().includes(q)
    );
  });

  const totalAmount = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const unbilledCount = filteredEntries.filter((e) => !e.is_billed).length;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: '16px', marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
            Billable Services & Time Entries
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Log counsel time sheets, court appearances, fixed retainers, and practice disbursements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingEntry(null);
            setShowModal(true);
          }}
          style={{
            padding: '10px 20px', borderRadius: '8px', backgroundColor: '#0f172a',
            color: '#ffffff', fontWeight: '600', fontSize: '0.9rem', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          + Log Billable Fee Entry
        </button>
      </div>

      {/* Summary Chips */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px', marginBottom: '20px'
      }}>
        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
          padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>TOTAL AMOUNT</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <IconHourglass size={20} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
          padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>UNBILLED ENTRIES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>
              {unbilledCount} pending
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fffbeb', color: '#d97706' }}>
            ⏳
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap',
        justifyContent: 'space-between', alignItems: 'center', gap: '12px'
      }}>
        <div style={{ flex: '1 1 280px', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search entries by description, client or case..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
              borderRadius: '8px', fontSize: '0.9rem', color: '#0f172a'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* Unbilled filter toggle */}
          <button
            type="button"
            onClick={() => setUnbilledOnly(!unbilledOnly)}
            style={{
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600',
              border: '1px solid', cursor: 'pointer',
              backgroundColor: unbilledOnly ? '#d97706' : '#ffffff',
              color: unbilledOnly ? '#ffffff' : '#334155',
              borderColor: unbilledOnly ? '#d97706' : '#cbd5e1'
            }}
          >
            {unbilledOnly ? '✓ Showing Unbilled Only' : 'Filter: Unbilled Only'}
          </button>

          {/* Type dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
              fontSize: '0.8rem', color: '#0f172a', backgroundColor: '#ffffff'
            }}
          >
            <option value="">All Fee Types</option>
            <option value="TIME">Time Based</option>
            <option value="APPEARANCE">Court Appearance</option>
            <option value="FIXED_FEE">Fixed Fee</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
      </div>

      {/* Entries Table */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading billable entries...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#b91c1c' }}>{error}</div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: '600', color: '#334155' }}>
              No fee entries found
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Log billable hours or court appearances using the button above.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Client / Matter</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Service Narrative</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Billing Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', color: '#334155', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {e.date}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
                        backgroundColor: e.entry_type === 'TIME' ? '#eff6ff' : e.entry_type === 'APPEARANCE' ? '#f5f3ff' : '#f8fafc',
                        color: e.entry_type === 'TIME' ? '#1d4ed8' : e.entry_type === 'APPEARANCE' ? '#7c3aed' : '#475569'
                      }}>
                        {e.entry_type}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{e.client_name}</div>
                      {e.case_title && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {e.case_number ? `${e.case_number} - ` : ''}{e.case_title}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', color: '#0f172a', maxWidth: '300px' }}>
                      <div>{e.description}</div>
                      {e.entry_type === 'TIME' && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {(e.duration_minutes / 60).toFixed(1)} hrs @ ₹{parseFloat(e.rate || 0)}/hr
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                      ₹{parseFloat(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {e.is_billed ? (
                        <span style={{
                          padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem',
                          fontWeight: '600', backgroundColor: '#ecfdf5', color: '#065f46'
                        }}>
                          Billed
                        </span>
                      ) : (
                        <span style={{
                          padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem',
                          fontWeight: '600', backgroundColor: '#fffbeb', color: '#b45309'
                        }}>
                          Unbilled
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {!e.is_billed ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEntry(e);
                              setShowModal(true);
                            }}
                            style={{
                              padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff', color: '#334155', fontSize: '0.75rem',
                              fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(e.id)}
                            style={{
                              padding: '4px 8px', borderRadius: '4px', border: '1px solid #fecaca',
                              backgroundColor: '#fff1f2', color: '#b91c1c', fontSize: '0.75rem',
                              fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Locked (Invoiced)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fee Entry Modal */}
      {showModal && (
        <FeeEntryModal
          feeEntry={editingEntry}
          onClose={() => {
            setShowModal(false);
            setEditingEntry(null);
          }}
          onSuccess={() => {
            fetchEntries();
          }}
        />
      )}
    </div>
  );
};

export default FeeEntriesPage;
