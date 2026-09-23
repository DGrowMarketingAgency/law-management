import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import causeListService from '../../services/causeListService';
import courtService from '../../services/courtService';
import { IconCourthouse } from '../../components/common/Icons';

const CauseListPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState('TODAY'); // 'TODAY' | 'TOMORROW' | 'CUSTOM'
  const [courtId, setCourtId] = useState('');
  const [courts, setCourts] = useState([]);

  const [causeData, setCauseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCourts();
  }, []);

  useEffect(() => {
    fetchCauseList();
  }, [selectedDate, courtId]);

  const fetchCourts = async () => {
    try {
      const res = await courtService.getCourts({ limit: 100, is_active: true });
      setCourts(res.data.items || []);
    } catch (err) {
      console.error('Failed to load courts:', err);
    }
  };

  const fetchCauseList = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await causeListService.getCauseList({
        date: selectedDate,
        court_id: courtId,
      });
      setCauseData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load chambers cause list');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMode = (mode) => {
    setViewMode(mode);
    const today = new Date();
    if (mode === 'TODAY') {
      setSelectedDate(today.toISOString().slice(0, 10));
    } else if (mode === 'TOMORROW') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().slice(0, 10));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Chambers Daily Cause List</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Aggregated court appearances grouped by Court Bench, Hearing Time, and Case Matter.
          </p>
        </div>
        <Link to="/cases" className="btn btn-secondary">&larr; View Case Docket</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Date & Court Navigation Toolbar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => handleSelectMode('TODAY')}
            className={viewMode === 'TODAY' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '0.85rem' }}
          >
            Today's List
          </button>
          <button
            onClick={() => handleSelectMode('TOMORROW')}
            className={viewMode === 'TOMORROW' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '0.85rem' }}
          >
            Tomorrow's List
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setViewMode('CUSTOM'); setSelectedDate(e.target.value); }}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Filter Court:</label>
          <select
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
          >
            <option value="">All Courts / Benches</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped Cause List */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Generating Chambers Cause List for {selectedDate}...</div>
      ) : (!causeData?.courts || causeData.courts.length === 0) ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No hearings or court appearances listed for <strong>{new Date(selectedDate).toLocaleDateString()}</strong>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {causeData.courts.map((group) => (
            <div key={group.court.id || 'unassigned'} className="card table-card-scroll" style={{ padding: '0', overflowX: 'auto' }}>
              {/* Court Header */}
              <div style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconCourthouse size={20} /> {group.court.name}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {group.court.courtType} &bull; {group.court.city || 'Jurisdiction'}
                  </div>
                </div>
                <span className="badge" style={{ backgroundColor: '#000000', color: '#ffffff', fontWeight: 600, border: '1px solid #000000', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                  {group.hearings.length} Hearing{group.hearings.length > 1 ? 's' : ''} Listed
                </span>
              </div>

              {/* Hearings in this Court */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.hearings.map((h, idx) => (
                  <div key={h.hearingId} style={{
                    padding: '1rem 1.5rem',
                    borderBottom: idx === group.hearings.length - 1 ? 'none' : '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                      {/* Time Block */}
                      <div style={{
                        minWidth: '80px',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderRadius: '4px',
                        textAlign: 'center',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        fontSize: '0.9rem'
                      }}>
                        {h.time ? `${h.time} IST` : 'Unscheduled'}
                      </div>

                      {/* Case Details */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Link to={`/cases/${h.case.id}`} style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
                            {h.case.caseNumber} &bull; {h.case.title}
                          </Link>
                          {h.case.cnrNumber && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>CNR: {h.case.cnrNumber}</span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                          Client: <strong>{h.case.clientName}</strong> ({h.case.clientCode}) &bull; Stage: {h.case.stage}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', marginTop: '0.25rem' }}>
                          <strong>Purpose:</strong> {h.purpose || 'Hearing'}
                          {h.courtroom && ` \u2022 Bench: ${h.courtroom}`}
                          {h.judge && ` \u2022 Coram: ${h.judge}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                      <span className="badge" style={{
                        backgroundColor: h.status === 'SCHEDULED' ? '#ede9fe' : h.status === 'ADJOURNED' ? '#fef3c7' : 'var(--color-success-bg)',
                        color: h.status === 'SCHEDULED' ? '#6d28d9' : h.status === 'ADJOURNED' ? '#b45309' : 'var(--color-success)',
                        fontSize: '0.8rem'
                      }}>
                        {h.status}
                      </span>
                      <Link to={`/cases/${h.case.id}`} className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
                        Dossier &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CauseListPage;
