import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import contactService from '../services/contactService';

const ContactDetail = () => {
  const { id } = useParams();
  const [contact, setContact] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Address Modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressData, setAddressData] = useState({
    address_type: 'OFFICE',
    address_line_1: '',
    address_line_2: '',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    postal_code: '',
  });

  useEffect(() => {
    fetchContactAndTimeline();
  }, [id]);

  const fetchContactAndTimeline = async () => {
    try {
      setLoading(true);
      setError('');
      const [contactRes, timelineRes] = await Promise.all([
        contactService.getContactById(id),
        contactService.getTimeline(id),
      ]);
      setContact(contactRes.data.contact);
      setTimeline(timelineRes.data.timeline || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contact records');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await contactService.addAddress(id, addressData);
      setShowAddressModal(false);
      setAddressData({
        address_type: 'OFFICE',
        address_line_1: '',
        address_line_2: '',
        city: 'New Delhi',
        state: 'Delhi',
        country: 'India',
        postal_code: '',
      });
      fetchContactAndTimeline();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add address');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await contactService.deleteAddress(id, addressId);
      fetchContactAndTimeline();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete address');
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading 360° Relationship Dossier...</div>;
  }

  if (error || !contact) {
    return <div className="alert alert-danger">{error || 'Contact not found'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Breadcrumb Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
            <Link to="/contacts" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>&larr; Back to Directory</Link>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            {contact.displayName}
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
            <span className="badge" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>{contact.contactType}</span>
            {contact.organizationName && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>&bull; {contact.organizationName}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {contact.clientProfile ? (
            <Link to={`/clients/${contact.clientProfile.id}`} className="btn btn-secondary">
              View Client Profile ({contact.clientProfile.clientCode})
            </Link>
          ) : (
            <Link to="/leads" className="btn btn-secondary">
              Pipeline Status
            </Link>
          )}
          <button onClick={() => setShowAddressModal(true)} className="btn btn-primary">+ Add Address</button>
        </div>
      </div>

      {/* Main Grid: Details + Unified Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(450px, 2fr)', gap: '1.5rem' }}>
        
        {/* Left Column: Metadata & Addresses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Primary Details
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Full Legal Name</span>
                <strong>{contact.firstName || '—'} {contact.lastName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Phone</span>
                <strong>{contact.phone || '—'}</strong>
                {contact.alternatePhone && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Alt: {contact.alternatePhone}</div>}
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Email Address</span>
                <strong>{contact.email || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Organization / Chambers</span>
                <strong>{contact.organizationName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Intake Notes</span>
                <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', color: 'var(--color-secondary)' }}>{contact.notes || 'No general notes.'}</p>
              </div>
            </div>
          </div>

          {/* Addresses Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Addresses</h2>
              <button onClick={() => setShowAddressModal(true)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.85rem' }}>
                + Add
              </button>
            </div>

            {(!contact.addresses || contact.addresses.length === 0) ? (
              <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>No registered addresses.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {contact.addresses.map((addr) => (
                  <div key={addr.id} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge" style={{ fontSize: '0.7rem' }}>{addr.addressType}</span>
                      <button onClick={() => handleDeleteAddress(addr.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
                        Remove
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--color-primary)' }}>
                      {addr.addressLine1}
                      {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                      <div>{addr.city}, {addr.state} - {addr.postalCode}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{addr.country}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Unified 360° Interaction Timeline */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Unified Chambers Timeline (360°)</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Chronological history across inquiries, consultations, appointments, consents, and tasks.</p>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No interactions recorded on this contact yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {timeline.map((evt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', borderLeft: '2px solid var(--color-border)', paddingLeft: '1rem', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-7px',
                    top: '4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: evt.type.includes('RETAINED') || evt.type.includes('CLIENT') ? 'var(--color-success)' : evt.type.includes('CONSENT') ? '#7c3aed' : 'var(--color-accent)'
                  }} />
                  <div style={{ flex: 1, backgroundColor: 'var(--color-bg-subtle)', padding: '0.75rem 1rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{evt.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)' }}>{evt.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>
                      Event Category: <strong>{evt.type}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Add Address Modal */}
      {showAddressModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Add Contact Address</h2>
            <form onSubmit={handleAddAddress} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Address Type</label>
                <select
                  value={addressData.address_type}
                  onChange={(e) => setAddressData({ ...addressData, address_type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="OFFICE">Office</option>
                  <option value="HOME">Home</option>
                  <option value="COURT">Court / Tribunal</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Address Line 1</label>
                <input
                  type="text"
                  required
                  value={addressData.address_line_1}
                  onChange={(e) => setAddressData({ ...addressData, address_line_1: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Address Line 2</label>
                <input
                  type="text"
                  value={addressData.address_line_2}
                  onChange={(e) => setAddressData({ ...addressData, address_line_2: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>City</label>
                  <input
                    type="text"
                    required
                    value={addressData.city}
                    onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>State</label>
                  <input
                    type="text"
                    required
                    value={addressData.state}
                    onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Postal Code / PIN</label>
                  <input
                    type="text"
                    required
                    value={addressData.postal_code}
                    onChange={(e) => setAddressData({ ...addressData, postal_code: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Country</label>
                  <input
                    type="text"
                    value={addressData.country}
                    onChange={(e) => setAddressData({ ...addressData, country: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddressModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Address</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactDetail;
