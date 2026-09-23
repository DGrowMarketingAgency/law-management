import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import clientService from '../../services/clientService';
import caseService from '../../services/caseService';
import feeEntryService from '../../services/feeEntryService';
import invoiceService from '../../services/invoiceService';

export const CreateInvoicePage = () => {
  const navigate = useNavigate();

  // Dropdown lists
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [unbilledEntries, setUnbilledEntries] = useState([]);
  const [loadingUnbilled, setLoadingUnbilled] = useState(false);

  // Form State
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [taxType, setTaxType] = useState('CGST_SGST');
  const [rcmApplicable, setRcmApplicable] = useState(false);
  const [clientGstin, setClientGstin] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('Tamil Nadu (33)');
  const [discountType, setDiscountType] = useState('FIXED');
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('Thank you for choosing our Chambers. Please settle dues within the stipulated due date.');
  const [terms, setTerms] = useState('Payment by Bank Transfer (NEFT/RTGS) or Cheque in favor of Senior Counsel / Chambers.');

  // Line items
  const [items, setItems] = useState([
    {
      description: 'Professional Legal Counsel & Advisory Services',
      quantity: 1,
      unit_price: 15000,
      tax_rate: 18,
      fee_entry_id: null
    }
  ]);

  // Selected fee entry IDs
  const [selectedFeeEntryIds, setSelectedFeeEntryIds] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const clientRes = await clientService.getClients({ limit: 100 });
      const rawClients = clientRes.data?.items || (Array.isArray(clientRes.data) ? clientRes.data : []);
      setClients(rawClients.map(c => ({
        id: c.id,
        display_name: c.contact?.displayName || c.display_name || c.clientCode || `Client #${c.id}`,
        client_type: c.contact?.contactType || c.client_type || 'INDIVIDUAL'
      })));
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  // When client changes, load cases and unbilled fee entries
  const handleClientChange = async (selectedId) => {
    setClientId(selectedId);
    setCaseId('');
    setUnbilledEntries([]);
    setSelectedFeeEntryIds([]);

    if (!selectedId) return;

    try {
      const caseRes = await caseService.getCases({ client_id: selectedId, limit: 100 });
      const rawCases = caseRes.data?.items || (Array.isArray(caseRes.data) ? caseRes.data : []);
      setCases(rawCases.map(cs => ({
        id: cs.id,
        title: cs.title,
        case_number: cs.caseNumber || cs.case_number || ''
      })));

      setLoadingUnbilled(true);
      const unbilledRes = await feeEntryService.getUnbilledFeeEntries({ client_id: selectedId });
      const rawUnbilled = unbilledRes.data?.items || (Array.isArray(unbilledRes.data) ? unbilledRes.data : []);
      setUnbilledEntries(rawUnbilled);
    } catch (err) {
      console.error('Failed to load client details:', err);
    } finally {
      setLoadingUnbilled(false);
    }
  };

  // When checking/unchecking an unbilled fee entry
  const toggleFeeEntry = (entry) => {
    const isSelected = selectedFeeEntryIds.includes(entry.id);
    if (isSelected) {
      setSelectedFeeEntryIds(selectedFeeEntryIds.filter((id) => id !== entry.id));
      setItems(items.filter((item) => item.fee_entry_id !== entry.id));
    } else {
      setSelectedFeeEntryIds([...selectedFeeEntryIds, entry.id]);
      setItems([
        ...items,
        {
          description: `${entry.entry_type}: ${entry.description}`,
          quantity: 1,
          unit_price: parseFloat(entry.amount),
          tax_rate: rcmApplicable ? 0 : 18,
          fee_entry_id: entry.id
        }
      ]);
    }
  };

  // Line item helpers
  const handleItemChange = (index, field, val) => {
    const next = [...items];
    next[index][field] = val;
    setItems(next);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unit_price: 5000,
        tax_rate: rcmApplicable ? 0 : 18,
        fee_entry_id: null
      }
    ]);
  };

  const removeItem = (index) => {
    const item = items[index];
    if (item.fee_entry_id) {
      setSelectedFeeEntryIds(selectedFeeEntryIds.filter((id) => id !== item.fee_entry_id));
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Live Financial Calculations
  const subtotal = items.reduce((sum, it) => {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return sum + (q * p);
  }, 0);

  const numDiscVal = parseFloat(discountValue) || 0;
  const discountAmount = discountType === 'PERCENTAGE'
    ? (subtotal * (numDiscVal / 100))
    : Math.min(numDiscVal, subtotal);

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let totalTax = 0;

  if (!rcmApplicable) {
    if (taxType === 'CGST_SGST') {
      cgstAmount = Math.round((taxableAmount * 0.09) * 100) / 100;
      sgstAmount = Math.round((taxableAmount * 0.09) * 100) / 100;
      totalTax = cgstAmount + sgstAmount;
    } else if (taxType === 'IGST') {
      igstAmount = Math.round((taxableAmount * 0.18) * 100) / 100;
      totalTax = igstAmount;
    }
  }

  const grandTotal = Math.round((taxableAmount + totalTax) * 100) / 100;

  // Submit Handler
  const handleSaveInvoice = async (issueImmediately = false) => {
    setError(null);

    if (!clientId) {
      setError('Please select a client.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one line item to the invoice.');
      return;
    }
    for (const it of items) {
      if (!it.description?.trim()) {
        setError('Every line item must have a valid description.');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        client_id: parseInt(clientId, 10),
        case_id: caseId ? parseInt(caseId, 10) : null,
        invoice_date: issueDate,
        issue_date: issueDate,
        due_date: dueDate,
        tax_type: taxType,
        rcm_applicable: rcmApplicable,
        client_gstin: clientGstin || null,
        place_of_supply: placeOfSupply || null,
        discount_type: discountType,
        discount_value: numDiscVal,
        notes,
        terms,
        fee_entry_ids: selectedFeeEntryIds || [],
        custom_items: items.map((it) => ({
          description: it.description.trim(),
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          tax_rate: rcmApplicable ? 0 : parseFloat(it.tax_rate) || 0,
          fee_entry_id: it.fee_entry_id || null
        })),
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          tax_rate: rcmApplicable ? 0 : parseFloat(it.tax_rate) || 0,
          fee_entry_id: it.fee_entry_id || null
        }))
      };

      const res = await invoiceService.createInvoice(payload);
      const createdInvoice = res.data;

      if (issueImmediately) {
        await invoiceService.issueInvoice(createdInvoice.id);
      }

      navigate(`/invoices/${createdInvoice.id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Breadcrumb / Top Bar */}
      <div style={{ marginBottom: '20px' }}>
        <Link to="/invoices" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Back to Invoices
        </Link>
        <h1 style={{ margin: '8px 0 0', fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
          Draft New Chambers Invoice
        </h1>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '16px', color: '#b91c1c', marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Grid Layout: Invoice Form + Summary Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left Column: Form Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Client & Matter */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
              1. Client & Matter Association
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Client *
                </label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                  }}
                >
                  <option value="">-- Select Client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} {c.client_type === 'CORPORATE' ? '🏢 (Corporate)' : '👤 (Individual)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Case / Matter (Optional)
                </label>
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                  }}
                >
                  <option value="">-- General Retainer / Advisory --</option>
                  {cases.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.case_number ? `${cs.case_number} - ` : ''}{cs.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Invoice Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Payment Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#0f172a'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Unbilled Fee Entries (If any) */}
          {clientId && (
            <div style={{
              backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                2. Import Unbilled Billable Entries
              </h2>
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#64748b' }}>
                Select recorded counsel appearances, time logs, and disbursements to attach to this invoice.
              </p>

              {loadingUnbilled ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Checking unbilled entries...</p>
              ) : unbilledEntries.length === 0 ? (
                <div style={{
                  padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc',
                  fontSize: '0.85rem', color: '#64748b', textAlign: 'center'
                }}>
                  No unbilled fee entries found for this client. You can manually enter line items below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {unbilledEntries.map((entry) => {
                    const isChecked = selectedFeeEntryIds.includes(entry.id);
                    return (
                      <label
                        key={entry.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: '8px', border: '1px solid',
                          borderColor: isChecked ? '#2563eb' : '#e2e8f0',
                          backgroundColor: isChecked ? '#eff6ff' : '#f8fafc',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFeeEntry(entry)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>
                              [{entry.entry_type}] {entry.description}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Date: {entry.date} {entry.case_title ? `• ${entry.case_title}` : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a' }}>
                          ₹{parseFloat(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Line Items */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                3. Invoice Line Items
              </h2>
              <button
                type="button"
                onClick={addItem}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.8rem',
                  fontWeight: '600', cursor: 'pointer'
                }}
              >
                + Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map((it, idx) => {
                const lineTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
                return (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px',
                      backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Description of legal service / court appearance / drafting..."
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        style={{
                          flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
                          fontSize: '0.9rem', color: '#0f172a'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        style={{
                          background: 'none', border: 'none', color: '#dc2626', fontSize: '1.2rem',
                          cursor: items.length === 1 ? 'not-allowed' : 'pointer', padding: '0 6px',
                          opacity: items.length === 1 ? 0.3 : 1
                        }}
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr', gap: '8px', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Qty / Units</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          style={{
                            width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Rate (₹)</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={it.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          style={{
                            width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px',
                            fontSize: '0.85rem', fontWeight: '600'
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tax Rate</span>
                        <input
                          type="text"
                          disabled
                          value={rcmApplicable ? '0% (RCM)' : '18%'}
                          style={{
                            width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px',
                            fontSize: '0.8rem', backgroundColor: '#f8fafc', color: '#64748b'
                          }}
                        />
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Line Total</span>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Taxes & Compliance */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
              4. GST & Reverse Charge Mechanism (RCM)
            </h2>

            {/* RCM Toggle */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px',
              borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff',
              cursor: 'pointer', marginBottom: '16px'
            }}>
              <input
                type="checkbox"
                checked={rcmApplicable}
                onChange={(e) => setRcmApplicable(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px' }}
              />
              <div>
                <span style={{ fontWeight: '700', color: '#1e40af', fontSize: '0.9rem' }}>
                  Reverse Charge Mechanism (RCM) Applicable
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#1e3a8a' }}>
                  Tax on legal services to business entities is payable directly by the recipient under Section 9(3) of CGST Act. Bill displays 0% tax with statutory notification.
                </p>
              </div>
            </label>

            {!rcmApplicable && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Tax Configuration *
                  </label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                      fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#fff'
                    }}
                  >
                    <option value="CGST_SGST">Intra-State: CGST (9%) + SGST (9%) = 18%</option>
                    <option value="IGST">Inter-State: IGST (18%)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Place of Supply (State Code)
                  </label>
                  <input
                    type="text"
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                      fontSize: '0.9rem', color: '#0f172a'
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Client GSTIN (15 Alphanumeric Characters, Optional)
              </label>
              <input
                type="text"
                maxLength="15"
                placeholder="e.g. 33AAAAA0000A1Z5"
                value={clientGstin}
                onChange={(e) => setClientGstin(e.target.value.toUpperCase())}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.9rem', color: '#0f172a', textTransform: 'uppercase'
                }}
              />
            </div>
          </div>

          {/* Section 5: Notes & Terms */}
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
              5. Chambers Notes & Payment Terms
            </h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Notes / Communication to Client
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.85rem', color: '#0f172a'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Payment Terms & Bank Details
              </label>
              <textarea
                rows="2"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  fontSize: '0.85rem', color: '#0f172a'
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Financial Calculation Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'sticky', top: '24px'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' }}>
              Financial Summary
            </h2>

            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Item Subtotal</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>
                ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Discount Setting */}
            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Discount</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setDiscountType('FIXED')}
                    style={{
                      padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid',
                      backgroundColor: discountType === 'FIXED' ? '#0f172a' : '#fff',
                      color: discountType === 'FIXED' ? '#fff' : '#64748b',
                      borderColor: '#cbd5e1'
                    }}
                  >
                    Fixed ₹
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENTAGE')}
                    style={{
                      padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid',
                      backgroundColor: discountType === 'PERCENTAGE' ? '#0f172a' : '#fff',
                      color: discountType === 'PERCENTAGE' ? '#fff' : '#64748b',
                      borderColor: '#cbd5e1'
                    }}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px',
                  fontSize: '0.85rem', textAlign: 'right'
                }}
              />
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.85rem', color: '#059669' }}>
                  <span>Less Discount</span>
                  <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Taxable Amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Taxable Amount</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>
                ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Tax Details */}
            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', marginBottom: '16px' }}>
              {rcmApplicable ? (
                <div style={{
                  padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f5f3ff',
                  color: '#6d28d9', fontSize: '0.8rem', fontWeight: '600'
                }}>
                  ⚖️ RCM Applicable: GST (₹0.00 on bill). Client pays directly to Govt.
                </div>
              ) : taxType === 'CGST_SGST' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>CGST (9%)</span>
                    <span style={{ color: '#0f172a' }}>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>SGST (9%)</span>
                    <span style={{ color: '#0f172a' }}>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>IGST (18%)</span>
                  <span style={{ color: '#0f172a' }}>₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div style={{
              borderTop: '2px solid #0f172a', paddingTop: '14px', marginBottom: '24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
            }}>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>Total Amount</span>
              <span style={{ fontSize: '1.45rem', fontWeight: '900', color: '#0f172a' }}>
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleSaveInvoice(false)}
                disabled={saving}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '700',
                  fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                {saving ? 'Saving...' : '💾 Save as Draft'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveInvoice(true)}
                disabled={saving}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '700',
                  fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {saving ? 'Processing...' : '⚡ Save & Issue Immediately'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoicePage;
