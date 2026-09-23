import React, { useState, useEffect } from 'react';
import workforceService from '../../services/workforceService';
import {
  Laptop,
  Key,
  Shield,
  BookOpen,
  Box,
  Plus,
  Filter,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight
} from '../../components/common/Icons';

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Forms
  const [assignForm, setAssignForm] = useState({
    workforce_id: '',
    asset_tag: '',
    asset_name: '',
    asset_type: 'LAPTOP',
    serial_number: '',
    condition_on_issue: 'EXCELLENT',
    issued_at: new Date().toISOString().split('T')[0]
  });

  const [returnForm, setReturnForm] = useState({
    condition_on_return: 'GOOD',
    notes: '',
    returned_at: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.asset_type = typeFilter;

      const res = await workforceService.getAssets(params);
      setAssets(res.data || []);

      if (members.length === 0) {
        const memRes = await workforceService.getDirectory({ status: 'ACTIVE', limit: 100 });
        setMembers(memRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError(err.response?.data?.message || 'Failed to load assets.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await workforceService.assignAsset({
        workforce_id: parseInt(assignForm.workforce_id),
        asset_tag: assignForm.asset_tag,
        asset_name: assignForm.asset_name,
        asset_type: assignForm.asset_type,
        serial_number: assignForm.serial_number,
        condition_on_issue: assignForm.condition_on_issue,
        issued_at: assignForm.issued_at
      });
      setSuccessMsg('Asset assigned successfully.');
      setShowAssignModal(false);
      setAssignForm({
        workforce_id: '',
        asset_tag: '',
        asset_name: '',
        asset_type: 'LAPTOP',
        serial_number: '',
        condition_on_issue: 'EXCELLENT',
        issued_at: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign asset.');
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      await workforceService.returnAsset(selectedAsset.id, {
        condition_on_return: returnForm.condition_on_return,
        notes: returnForm.notes,
        returned_at: returnForm.returned_at
      });
      setSuccessMsg('Asset marked as RETURNED successfully.');
      setShowReturnModal(false);
      setSelectedAsset(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return asset.');
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (a.asset_name && a.asset_name.toLowerCase().includes(term)) ||
      (a.asset_tag && a.asset_tag.toLowerCase().includes(term)) ||
      (a.serial_number && a.serial_number.toLowerCase().includes(term)) ||
      (a.full_name && a.full_name.toLowerCase().includes(term))
    );
  });

  const activeAssignedCount = assets.filter(a => a.status === 'ASSIGNED').length;
  const laptopsCount = assets.filter(a => a.asset_type === 'LAPTOP' && a.status === 'ASSIGNED').length;
  const cardsCount = assets.filter(a => a.asset_type === 'ACCESS_CARD' && a.status === 'ASSIGNED').length;
  const keysCount = assets.filter(a => a.asset_type === 'CHAMBERS_KEY' && a.status === 'ASSIGNED').length;

  const getAssetIcon = (type) => {
    switch (type) {
      case 'LAPTOP': return <Laptop size={18} />;
      case 'CHAMBERS_KEY': return <Key size={18} />;
      case 'ACCESS_CARD': return <Shield size={18} />;
      case 'LIBRARY_BOOK': return <BookOpen size={18} />;
      default: return <Box size={18} />;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            Chambers Asset Management
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Track laptops, chamber keys, access badges, and library resources issued to employees & interns.
          </p>
        </div>

        <button
          onClick={() => setShowAssignModal(true)}
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
          Issue New Asset
        </button>
      </div>

      {/* Alerts */}
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

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>TOTAL ASSIGNED</span>
            <Box size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{activeAssignedCount}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Items currently in possession</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>LAPTOPS OUT</span>
            <Laptop size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{laptopsCount}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Hardware devices</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>ACCESS CARDS</span>
            <Shield size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{cardsCount}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Building entrance badges</div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>CHAMBERS KEYS</span>
            <Key size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{keysCount}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Cabin & cabinet keys</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by asset name, tag, serial, or assignee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff' }}
        >
          <option value="">All Asset Types</option>
          <option value="LAPTOP">Laptops</option>
          <option value="ACCESS_CARD">Access Cards</option>
          <option value="CHAMBERS_KEY">Chambers Keys</option>
          <option value="LIBRARY_BOOK">Library Books</option>
          <option value="DESK_TOKEN">Desk Tokens</option>
          <option value="OTHER">Other Assets</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff' }}
        >
          <option value="">All Statuses</option>
          <option value="ASSIGNED">Assigned (Active)</option>
          <option value="RETURNED">Returned</option>
          <option value="DAMAGED">Damaged</option>
          <option value="LOST">Lost</option>
        </select>

        {(search || statusFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); }}
            style={{ fontSize: '13px', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          Loading asset records...
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Asset Tag & Name</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Type</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Assigned To</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Issued Date</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Condition</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No chambers assets found.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                          {getAssetIcon(a.asset_type)}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{a.asset_name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                            {a.asset_tag} {a.serial_number && `• SN: ${a.serial_number}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                      {a.asset_type.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{a.full_name || 'Unassigned'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{a.workforce_code}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                      {a.issued_at ? a.issued_at.slice(0, 10) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                      <span style={{ fontSize: '12px' }}>Issue: <strong>{a.condition_on_issue}</strong></span>
                      {a.condition_on_return && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Return: <strong>{a.condition_on_return}</strong>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor:
                            a.status === 'ASSIGNED'
                              ? '#dcfce7'
                              : a.status === 'RETURNED'
                              ? '#f1f5f9'
                              : '#fee2e2',
                          color:
                            a.status === 'ASSIGNED'
                              ? '#166534'
                              : a.status === 'RETURNED'
                              ? '#475569'
                              : '#991b1b'
                        }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {a.status === 'ASSIGNED' ? (
                        <button
                          onClick={() => {
                            setSelectedAsset(a);
                            setShowReturnModal(true);
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
                          Process Return
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Returned</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Issue Asset */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 0' }}>
              Issue Chambers Asset
            </h2>

            <form onSubmit={handleAssign}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Assign To Member *
                </label>
                <select
                  required
                  value={assignForm.workforce_id}
                  onChange={(e) => setAssignForm({ ...assignForm, workforce_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.workforce_code} - {m.workforce_type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Asset Type *
                  </label>
                  <select
                    required
                    value={assignForm.asset_type}
                    onChange={(e) => setAssignForm({ ...assignForm, asset_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="LAPTOP">Laptop / Computer</option>
                    <option value="ACCESS_CARD">Access Card / RFID</option>
                    <option value="CHAMBERS_KEY">Chambers Key</option>
                    <option value="LIBRARY_BOOK">Library / Bare Act</option>
                    <option value="DESK_TOKEN">Desk / Token</option>
                    <option value="OTHER">Other Asset</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Asset Tag / ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., AST-LAP-04"
                    value={assignForm.asset_tag}
                    onChange={(e) => setAssignForm({ ...assignForm, asset_tag: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Asset Name / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., ThinkPad T14 Gen 3 / Main Gate Key #4"
                  value={assignForm.asset_name}
                  onChange={(e) => setAssignForm({ ...assignForm, asset_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., PF3XZ9"
                    value={assignForm.serial_number}
                    onChange={(e) => setAssignForm({ ...assignForm, serial_number: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Condition on Issue *
                  </label>
                  <select
                    required
                    value={assignForm.condition_on_issue}
                    onChange={(e) => setAssignForm({ ...assignForm, condition_on_issue: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="EXCELLENT">Excellent / Brand New</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair / Minor Wear</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Issue Date *
                </label>
                <input
                  type="date"
                  required
                  value={assignForm.issued_at}
                  onChange={(e) => setAssignForm({ ...assignForm, issued_at: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Return */}
      {showReturnModal && selectedAsset && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px 0' }}>
              Process Asset Return
            </h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
              Confirming return of <strong>{selectedAsset.asset_name}</strong> ({selectedAsset.asset_tag}) from <strong>{selectedAsset.full_name}</strong>.
            </p>

            <form onSubmit={handleReturn}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Condition on Return *
                </label>
                <select
                  required
                  value={returnForm.condition_on_return}
                  onChange={(e) => setReturnForm({ ...returnForm, condition_on_return: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Return Date *
                </label>
                <input
                  type="date"
                  required
                  value={returnForm.returned_at}
                  onChange={(e) => setReturnForm({ ...returnForm, returned_at: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Notes / Inspection Remarks
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g., Power adapter included, no visible screen scratches"
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowReturnModal(false); setSelectedAsset(null); }}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
