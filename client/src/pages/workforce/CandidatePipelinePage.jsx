import React, { useState, useEffect } from 'react';
import { workforceService } from '../../services/workforceService';
import { WorkforceTypeBadge } from '../../components/workforce/WorkforceBadges';
import { IconSearch, IconClose, IconTarget, IconAward } from '../../components/common/Icons';

const CandidatePipelinePage = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stageFilter, setStageFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    applying_for: 'PAID_INTERN',
    college_institution: '',
    course_degree: '',
    graduation_year: 2027,
    source: 'DIRECT',
  });

  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [interviewForm, setInterviewForm] = useState({
    round_name: 'Round 1 - Legal Assessment',
    interviewer_user_id: 1,
    scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    mode: 'IN_PERSON',
  });

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    designation: 'Legal Intern',
    joining_date: new Date().toISOString().slice(0, 10),
    offered_compensation: 12000,
    terms: '8-week legal internship with Chambers litigation team.',
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await workforceService.getCandidates({
        stage: stageFilter,
        search,
        limit: 50,
      });
      if (res.success) {
        setCandidates(res.candidates || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch candidate pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [stageFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCandidates();
  };

  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await workforceService.createCandidate(formData);
      setShowAddModal(false);
      fetchCandidates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await workforceService.scheduleInterview(selectedCandidate.id, interviewForm);
      setShowInterviewModal(false);
      fetchCandidates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule interview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await workforceService.createOffer(selectedCandidate.id, offerForm);
      setShowOfferModal(false);
      fetchCandidates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to issue offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async (candidate) => {
    if (!window.confirm(`Accept offer for ${candidate.full_name}? This will auto-provision their Chambers Onboarding profile!`)) {
      return;
    }
    try {
      setSubmitting(true);
      // Fetch candidate details to get offer ID
      const details = await workforceService.getCandidate(candidate.id);
      const latestOffer = details.offers?.[0];
      if (!latestOffer) {
        alert('No offer found for this candidate.');
        return;
      }
      await workforceService.acceptOffer(latestOffer.id);
      alert('Offer accepted! Candidate transitioned to Chambers Onboarding.');
      fetchCandidates();
    } catch (err) {
      alert(err.response?.data?.message || 'Accept offer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const stages = [
    { key: 'APPLIED', label: 'Applied' },
    { key: 'SCREENING', label: 'Screening' },
    { key: 'INTERVIEW', label: 'Interviewing' },
    { key: 'SELECTED', label: 'Selected' },
    { key: 'OFFERED', label: 'Offer Issued' },
    { key: 'ACCEPTED', label: 'Offer Accepted' },
    { key: 'ONBOARDING', label: 'Onboarding' },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
            Recruitment & Internship Pipeline (ATS)
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Structured pipeline from law faculty applications to interview evaluation and Chambers onboarding.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '6px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          + Add Candidate Application
        </button>
      </div>

      {/* Filter */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search candidate name, email, college..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
              <IconSearch size={16} />
            </span>
          </div>

          <div style={{ flex: '0 1 200px' }}>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Pipeline Stages</option>
              {stages.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            style={{
              padding: '9px 16px',
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Filter
          </button>
        </form>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Candidate Cards List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading candidates...</p>
        ) : candidates.length === 0 ? (
          <p style={{ color: '#64748b' }}>No candidates found in this stage.</p>
        ) : (
          candidates.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '18px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{c.candidate_code}</span>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '2px 0 0 0' }}>
                    {c.full_name}
                  </h3>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                  }}
                >
                  {c.stage}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                <div><strong>Applying:</strong> <WorkforceTypeBadge type={c.applying_for} /></div>
                <div><strong>College:</strong> {c.college_institution || 'N/A'} ({c.course_degree || 'Law'})</div>
                <div><strong>Email:</strong> {c.email}</div>
                <div><strong>Phone:</strong> {c.phone}</div>
                {c.avg_rating && <div><strong>Rating:</strong> ⭐ {parseFloat(c.avg_rating).toFixed(1)} / 5</div>}
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap' }}>
                {c.stage !== 'REJECTED' && c.stage !== 'ACTIVE' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedCandidate(c);
                        setShowInterviewModal(true);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Schedule Interview
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCandidate(c);
                        setShowOfferModal(true);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Issue Offer
                    </button>

                    {c.stage === 'OFFERED' && (
                      <button
                        onClick={() => handleAcceptOffer(c)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Accept & Onboard
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Add New Candidate Application</h2>
            <form onSubmit={handleCreateCandidate}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Candidate Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Mobile Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Applying For *</label>
                <select
                  value={formData.applying_for}
                  onChange={(e) => setFormData({ ...formData, applying_for: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  <option value="PAID_INTERN">Paid Legal Intern</option>
                  <option value="UNPAID_INTERN">Unpaid Legal Intern</option>
                  <option value="EMPLOYEE">Associate Counsel (Employee)</option>
                  <option value="CONTRACTOR">Legal Consultant / Contractor</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>College / University</label>
                <input
                  type="text"
                  value={formData.college_institution}
                  onChange={(e) => setFormData({ ...formData, college_institution: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: '600' }}>Create Candidate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showInterviewModal && selectedCandidate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '450px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
              Schedule Interview: {selectedCandidate.full_name}
            </h3>
            <form onSubmit={handleScheduleInterview}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Round Name</label>
                <input
                  type="text"
                  required
                  value={interviewForm.round_name}
                  onChange={(e) => setInterviewForm({ ...interviewForm, round_name: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={interviewForm.scheduled_at}
                  onChange={(e) => setInterviewForm({ ...interviewForm, scheduled_at: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowInterviewModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: '600' }}>Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Offer Modal */}
      {showOfferModal && selectedCandidate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', maxWidth: '450px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
              Issue Offer Letter: {selectedCandidate.full_name}
            </h3>
            <form onSubmit={handleCreateOffer}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Designation *</label>
                <input
                  type="text"
                  required
                  value={offerForm.designation}
                  onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Proposed Joining Date *</label>
                <input
                  type="date"
                  required
                  value={offerForm.joining_date}
                  onChange={(e) => setOfferForm({ ...offerForm, joining_date: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Offered Monthly Compensation / Stipend (₹)</label>
                <input
                  type="number"
                  value={offerForm.offered_compensation}
                  onChange={(e) => setOfferForm({ ...offerForm, offered_compensation: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowOfferModal(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '6px 16px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: '600' }}>Issue Offer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatePipelinePage;
