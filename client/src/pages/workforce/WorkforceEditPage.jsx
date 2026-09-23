import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workforceService } from '../../services/workforceService';
import { WorkforceTypeBadge, WorkforceStatusBadge } from '../../components/workforce/WorkforceBadges';

const WorkforceEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [initialData, setInitialData] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    workforce_type: 'EMPLOYEE',
    designation: '',
    department: '',
    work_location: '',
    employment_mode: '',
    joining_date: '',
    expected_end_date: '',
    notes: '',
    // Employment record
    probation_period_days: 90,
    notice_period_days: 30,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    blood_group: '',
    // Intern record
    college_institution: '',
    stipend_amount: 0,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await workforceService.getProfile(id);
        if (res.success && res.data) {
          const { profile, employmentRecord, internshipRecord } = res.data;
          setInitialData(profile);
          setForm({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            email: profile.email || profile.user_email || '',
            phone: profile.phone || '',
            alternate_phone: profile.alternate_phone || '',
            workforce_type: profile.workforce_type || 'EMPLOYEE',
            designation: profile.designation || '',
            department: profile.department || '',
            work_location: profile.work_location || '',
            employment_mode: profile.employment_mode || '',
            joining_date: profile.joining_date ? profile.joining_date.slice(0, 10) : '',
            expected_end_date: profile.expected_end_date ? profile.expected_end_date.slice(0, 10) : '',
            notes: profile.notes || '',
            probation_period_days: employmentRecord?.probation_period_days ?? 90,
            notice_period_days: employmentRecord?.notice_period_days ?? 30,
            emergency_contact_name: employmentRecord?.emergency_contact_name || '',
            emergency_contact_phone: employmentRecord?.emergency_contact_phone || '',
            blood_group: employmentRecord?.blood_group || '',
            college_institution: internshipRecord?.college_institution || '',
            stipend_amount: internshipRecord?.stipend_amount ?? 0,
          });
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load member profile for editing');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!form.first_name.trim()) {
      setError('First name is required.');
      return;
    }
    if (!form.email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Primary phone number is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await workforceService.updateProfile(id, form);
      if (res.success) {
        setSuccessMsg('Workforce profile and associated records updated successfully!');
        setTimeout(() => {
          navigate(`/workforce/profiles/${id}`);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update workforce profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Loading workforce profile for editing...
      </div>
    );
  }

  if (!initialData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>
        {error || 'Member not found'}
      </div>
    );
  }

  const isIntern = form.workforce_type.includes('INTERN');

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
        <Link to="/workforce" style={{ color: '#3b82f6', textDecoration: 'none' }}>Workforce</Link>
        {' / '}
        <Link to="/workforce/directory" style={{ color: '#3b82f6', textDecoration: 'none' }}>Directory</Link>
        {' / '}
        <Link to={`/workforce/profiles/${id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{initialData.workforce_code}</Link>
        {' / '}
        <span style={{ color: '#0f172a', fontWeight: '600' }}>Edit Profile</span>
      </div>

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Edit Workforce Member
            </h1>
            <span style={{
              backgroundColor: '#f1f5f9',
              color: '#475569',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.5px'
            }}>
              {initialData.workforce_code}
            </span>
            <WorkforceStatusBadge status={initialData.status} />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
            Update personal contact, chambers designation, emergency info, and contractual specifics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate(`/workforce/profiles/${id}`)}
            style={{
              padding: '9px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '9px 20px',
              borderRadius: '6px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div style={{
          padding: '14px 18px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: '500',
        }}>
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          padding: '14px 18px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
        }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Card 1: Core Contact & Identity */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
            1. Identity & Contact Information
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px' }}>
            Updating name or email automatically updates the unified contact card and login credentials.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                First Name *
              </label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Phone Number *
              </label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Alternate Phone
              </label>
              <input
                type="text"
                name="alternate_phone"
                value={form.alternate_phone}
                onChange={handleChange}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                System Workforce Code (Immutable)
              </label>
              <input
                type="text"
                value={initialData.workforce_code}
                disabled
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  fontWeight: '600',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Chambers Employment Details */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
            2. Chambers Role & Department
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px' }}>
            Configure chamber designation, employment classification, and engagement timelines.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Workforce Classification
              </label>
              <select
                name="workforce_type"
                value={form.workforce_type}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              >
                <option value="EMPLOYEE">Regular Employee / Advocate</option>
                <option value="PAID_INTERN">Paid Intern</option>
                <option value="UNPAID_INTERN">Unpaid Intern</option>
                <option value="CONTRACTOR">Retainer / Contractor</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Designation *
              </label>
              <input
                type="text"
                name="designation"
                value={form.designation}
                onChange={handleChange}
                required
                placeholder="e.g. Senior Associate, Legal Researcher"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Department / Practice Group
              </label>
              <input
                type="text"
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="e.g. Litigation, Corporate, Arbitration"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Work Location
              </label>
              <input
                type="text"
                name="work_location"
                value={form.work_location}
                onChange={handleChange}
                placeholder="e.g. Main Chambers, High Court Annex"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Joining Date
              </label>
              <input
                type="date"
                name="joining_date"
                value={form.joining_date}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Expected End Date
              </label>
              <input
                type="date"
                name="expected_end_date"
                value={form.expected_end_date}
                onChange={handleChange}
                placeholder="Applicable for interns / contracts"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Internship Specifics (if Intern) */}
        {isIntern && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
              3. Law College & Internship Details
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px' }}>
              Specific records for legal interns and clinical clerkships.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Law School / University
                </label>
                <input
                  type="text"
                  name="college_institution"
                  value={form.college_institution}
                  onChange={handleChange}
                  placeholder="e.g. National Law School of India University"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Monthly Stipend Amount (₹)
                </label>
                <input
                  type="number"
                  name="stipend_amount"
                  value={form.stipend_amount}
                  onChange={handleChange}
                  disabled={form.workforce_type === 'UNPAID_INTERN'}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: form.workforce_type === 'UNPAID_INTERN' ? '#f1f5f9' : '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Card 4: Employment & Emergency Records */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
            4. Emergency & Terms of Employment
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px' }}>
            Probation period, notice duration, and emergency contact points.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Probation Period (Days)
              </label>
              <input
                type="number"
                name="probation_period_days"
                value={form.probation_period_days}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Notice Period (Days)
              </label>
              <input
                type="number"
                name="notice_period_days"
                value={form.notice_period_days}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Blood Group
              </label>
              <select
                name="blood_group"
                value={form.blood_group}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Emergency Contact Name
              </label>
              <input
                type="text"
                name="emergency_contact_name"
                value={form.emergency_contact_name}
                onChange={handleChange}
                placeholder="Parent, spouse, or guardian"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Emergency Contact Phone
              </label>
              <input
                type="text"
                name="emergency_contact_phone"
                value={form.emergency_contact_phone}
                onChange={handleChange}
                placeholder="Emergency hotline"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 5: Internal Notes */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
            5. Internal Notes & Remarks
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>
            Internal notes visible strictly to Managing Partners and HR Admins.
          </p>

          <textarea
            name="notes"
            rows="4"
            value={form.notes}
            onChange={handleChange}
            placeholder="Add relevant notes about skills, practice interests, bar qualifications, or chamber directives..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate(`/workforce/profiles/${id}`)}
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '10px 24px',
              borderRadius: '6px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkforceEditPage;
