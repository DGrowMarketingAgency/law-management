import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import caseService from '../../services/caseService';
import hearingService from '../../services/hearingService';
import contactService from '../../services/contactService';
import userService from '../../services/userService';
import deadlineService from '../../services/deadlineService';
import DeadlineList from '../../components/deadlines/DeadlineList';
import DeadlineCalculator from '../../components/deadlines/DeadlineCalculator';
import documentService from '../../services/documentService';
import DocumentUploadModal from '../../components/documents/DocumentUploadModal';
import { DocumentCategoryBadge, ConfidentialityBadge } from '../../components/documents/DocumentStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { IconClock, IconFolder, IconPhone } from '../../components/common/Icons';
import whatsappService from '../../services/whatsappService';

const CaseDetailPage = () => {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'DOCUMENTS' | 'PARTIES' | 'COUNSEL' | 'HEARINGS' | 'NOTES' | 'ASSIGNMENTS' | 'DEADLINES'
  const [caseData, setCaseData] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('ALL');
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);

  // Contacts lookup for parties & counsel
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);

  // Modals
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyForm, setPartyForm] = useState({ contact_id: '', party_role: 'DEFENDANT', party_description: '', is_primary: false });

  const [showCounselModal, setShowCounselModal] = useState(false);
  const [counselForm, setCounselForm] = useState({ contact_id: '', counsel_type: 'OPPOSING_COUNSEL', notes: '' });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: '', role_in_case: 'ASSIGNED_ASSOCIATE' });

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({ note_type: 'GENERAL', title: '', content: '' });

  const [showHearingModal, setShowHearingModal] = useState(false);
  const [hearingForm, setHearingForm] = useState({
    hearing_date: new Date().toISOString().slice(0, 10),
    hearing_time: '10:30',
    purpose: '',
    courtroom: '',
    judge: '',
    remarks: '',
  });

  const [showAdjournModal, setShowAdjournModal] = useState(false);
  const [selectedHearingId, setSelectedHearingId] = useState(null);
  const [adjournForm, setAdjournForm] = useState({ new_date: '', new_time: '10:30', reason: '', requested_by: '' });

  // WhatsApp Hearing Reminders State
  const [expandedHearingReminders, setExpandedHearingReminders] = useState({});
  const [manualSendModal, setManualSendModal] = useState({
    isOpen: false,
    hearing: null,
    client: null,
    sending: false,
    error: '',
  });

  useEffect(() => {
    fetchCaseDossier();
    fetchPrerequisites();
  }, [id]);

  const fetchCaseDossier = async () => {
    try {
      setLoading(true);
      setError('');
      const [cRes, hRes, nRes, dRes, docRes] = await Promise.all([
        caseService.getCaseById(id),
        hearingService.getHearings(id),
        caseService.getNotes(id),
        deadlineService.getCaseDeadlines(id),
        documentService.getCaseDocuments(id),
      ]);
      setCaseData(cRes.data.case);
      setHearings(hRes.data.hearings || []);
      setNotes(nRes.data.notes || []);
      setDeadlines(dRes.data?.deadlines || []);
      setDocuments(docRes.data?.documents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load case dossier');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrerequisites = async () => {
    try {
      const [cntRes, uRes] = await Promise.all([
        contactService.getContacts({ limit: 100 }),
        userService.getUsers({ limit: 100 }),
      ]);
      setContacts(cntRes.data.items || []);
      setUsers(uRes.data?.users || []);
    } catch (err) {
      console.error('Failed to load contacts/users:', err);
    }
  };

  // Party Actions
  const handleAddParty = async (e) => {
    e.preventDefault();
    try {
      await caseService.addParty(id, partyForm);
      setShowPartyModal(false);
      setPartyForm({ contact_id: '', party_role: 'DEFENDANT', party_description: '', is_primary: false });
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add party');
    }
  };

  const handleRemoveParty = async (partyId) => {
    if (!window.confirm('Remove party from case?')) return;
    try {
      await caseService.removeParty(id, partyId);
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove party');
    }
  };

  // Counsel Actions
  const handleAddCounsel = async (e) => {
    e.preventDefault();
    try {
      await caseService.addCounsel(id, counselForm);
      setShowCounselModal(false);
      setCounselForm({ contact_id: '', counsel_type: 'OPPOSING_COUNSEL', notes: '' });
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add counsel');
    }
  };

  const handleRemoveCounsel = async (counselId) => {
    if (!window.confirm('Remove counsel record?')) return;
    try {
      await caseService.removeCounsel(id, counselId);
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove counsel');
    }
  };

  // Assignment Actions
  const handleAssignUser = async (e) => {
    e.preventDefault();
    try {
      await caseService.assignUser(id, assignForm);
      setShowAssignModal(false);
      setAssignForm({ user_id: '', role_in_case: 'ASSIGNED_ASSOCIATE' });
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign user');
    }
  };

  const handleUnassignUser = async (assignmentId) => {
    if (!window.confirm('Unassign this advocate from the case?')) return;
    try {
      await caseService.unassignUser(id, assignmentId);
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unassign user');
    }
  };

  // Note Actions
  const handleAddNote = async (e) => {
    e.preventDefault();
    try {
      await caseService.createNote(id, noteForm);
      setShowNoteModal(false);
      setNoteForm({ note_type: 'GENERAL', title: '', content: '' });
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this case note?')) return;
    try {
      await caseService.deleteNote(id, noteId);
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete note');
    }
  };

  // Hearing Actions
  const handleCreateHearing = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...hearingForm,
        court_id: caseData.court?.id,
        hearing_time: hearingForm.hearing_time ? `${hearingForm.hearing_time}:00` : null,
      };
      await hearingService.createHearing(id, payload);
      setShowHearingModal(false);
      setHearingForm({ hearing_date: new Date().toISOString().slice(0, 10), hearing_time: '10:30', purpose: '', courtroom: '', judge: '', remarks: '' });
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule hearing');
    }
  };

  const handleAdjournSubmit = async (e) => {
    e.preventDefault();
    try {
      await hearingService.adjournHearing(id, selectedHearingId, adjournForm);
      setShowAdjournModal(false);
      setSelectedHearingId(null);
      setAdjournForm({ new_date: '', new_time: '10:30', reason: '', requested_by: '' });
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adjourn hearing');
    }
  };

  const handleCancelHearing = async (hearingId) => {
    if (!window.confirm('Cancel this hearing?')) return;
    try {
      await hearingService.deleteHearing(id, hearingId);
      fetchCaseDossier();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel hearing');
    }
  };

  const toggleHearingReminders = async (hearingId) => {
    if (expandedHearingReminders[hearingId]?.isOpen) {
      setExpandedHearingReminders((prev) => ({
        ...prev,
        [hearingId]: { ...prev[hearingId], isOpen: false },
      }));
      return;
    }

    setExpandedHearingReminders((prev) => ({
      ...prev,
      [hearingId]: { isOpen: true, loading: true, data: null, error: '' },
    }));

    try {
      const res = await whatsappService.getHearingReminders(hearingId);
      setExpandedHearingReminders((prev) => ({
        ...prev,
        [hearingId]: { isOpen: true, loading: false, data: res.data, error: '' },
      }));
    } catch (err) {
      setExpandedHearingReminders((prev) => ({
        ...prev,
        [hearingId]: {
          isOpen: true,
          loading: false,
          data: null,
          error: err.response?.data?.message || 'Failed to load reminders.',
        },
      }));
    }
  };

  const handleRegenerateReminders = async (hearingId) => {
    try {
      const res = await whatsappService.regenerateReminders(hearingId);
      setExpandedHearingReminders((prev) => ({
        ...prev,
        [hearingId]: { isOpen: true, loading: false, data: res.data, error: '' },
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regenerate reminders.');
    }
  };

  const handleCancelReminder = async (hearingId, reminderId) => {
    if (!window.confirm('Cancel this scheduled WhatsApp reminder?')) return;
    try {
      const res = await whatsappService.cancelReminder(hearingId, reminderId);
      setExpandedHearingReminders((prev) => ({
        ...prev,
        [hearingId]: { isOpen: true, loading: false, data: res.data, error: '' },
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel reminder.');
    }
  };

  const handleConfirmManualSend = async () => {
    if (!manualSendModal.hearing) return;
    setManualSendModal((prev) => ({ ...prev, sending: true, error: '' }));
    try {
      await whatsappService.sendManualReminder(manualSendModal.hearing.id);
      const res = await whatsappService.getHearingReminders(manualSendModal.hearing.id);
      setExpandedHearingReminders((prev) => ({
        ...prev,
        [manualSendModal.hearing.id]: { isOpen: true, loading: false, data: res.data, error: '' },
      }));
      setManualSendModal({ isOpen: false, hearing: null, client: null, sending: false, error: '' });
    } catch (err) {
      setManualSendModal((prev) => ({
        ...prev,
        sending: false,
        error: err.response?.data?.message || 'Failed to send manual reminder.',
      }));
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>Loading Case File...</div>;
  }

  if (error || !caseData) {
    return <div className="alert alert-danger">{error || 'Case file not found'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
            <Link to="/cases" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>&larr; Back to Case Docket</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {caseData.caseNumber} &bull; {caseData.title}
            </h1>
            <span className="badge" style={{
              backgroundColor: caseData.caseStatus === 'ACTIVE' ? 'var(--color-success-bg)' : '#fee2e2',
              color: caseData.caseStatus === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
              {caseData.caseStatus}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
            {caseData.court?.name} &bull; Stage: <strong>{caseData.caseStage}</strong> {caseData.cnrNumber && `\u2022 CNR: ${caseData.cnrNumber}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {hasPermission('DEADLINE_CREATE') && (
            <button
              onClick={() => setShowDeadlineModal(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', color: '#000000', borderColor: '#000000', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <IconClock size={15} /> + Limitation Deadline
            </button>
          )}
          <button onClick={() => setShowHearingModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            + Schedule Hearing
          </button>
          <button onClick={() => setShowNoteModal(true)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            + Add Note
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '0.5rem', overflowX: 'auto' }}>
        {[
          { key: 'OVERVIEW', label: 'Case Overview' },
          { key: 'DOCUMENTS', label: `Documents (${documents.length})` },
          { key: 'HEARINGS', label: `Hearings (${hearings.length})` },
          { key: 'DEADLINES', label: `Deadlines (${deadlines.length})` },
          { key: 'PARTIES', label: `Parties (${caseData.parties?.length || 0})` },
          { key: 'COUNSEL', label: `Counsel (${caseData.counsel?.length || 0})` },
          { key: 'NOTES', label: `Notes (${notes.length})` },
          { key: 'ASSIGNMENTS', label: `Advocate Team (${caseData.assignments?.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.6rem 1.2rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--color-accent)' : 'var(--color-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Court & Registry Data
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Court / Tribunal</span>
                <strong>{caseData.court?.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{caseData.court?.city}, {caseData.court?.state}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Case Type</span>
                <strong>{caseData.caseType}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Filing & Registration</span>
                <div>Filing Date: {caseData.filingDate ? new Date(caseData.filingDate).toLocaleDateString() : '—'}</div>
                <div>Registration: {caseData.registrationDate ? new Date(caseData.registrationDate).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Next Hearing Date</span>
                <strong style={{ color: caseData.nextHearingDate ? 'var(--color-accent)' : 'inherit', fontSize: '1rem' }}>
                  {caseData.nextHearingDate ? new Date(caseData.nextHearingDate).toLocaleDateString() : 'No upcoming hearing scheduled'}
                </strong>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              Client Representation & Brief
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Primary Client</span>
                <Link to={`/clients/${caseData.client?.id}`} style={{ fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
                  {caseData.client?.name} ({caseData.client?.clientCode})
                </Link>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{caseData.client?.phone} &bull; {caseData.client?.email}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Matter Synopsis</span>
                <p style={{ marginTop: '0.25rem', color: 'var(--color-secondary)', whiteSpace: 'pre-wrap' }}>
                  {caseData.description || 'No prayer or synopsis recorded.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DOCUMENTS (Case Folders & Legal Filings) */}
      {activeTab === 'DOCUMENTS' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
                Case Document Repository & Electronic Folders
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Organized filings, written statements, affidavits, orders, applications, and correspondence with version tracking.
              </p>
            </div>

            <button
              onClick={() => setShowDocumentUploadModal(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              + Upload Document
            </button>
          </div>

          {/* Folder Categories Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {[
              { key: 'ALL', label: 'All Documents' },
              { key: 'PLEADING', label: 'Pleadings & Petitions' },
              { key: 'AFFIDAVIT', label: 'Affidavits' },
              { key: 'EVIDENCE', label: 'Evidence' },
              { key: 'ORDER', label: 'Court Orders' },
              { key: 'APPLICATION', label: 'Applications' },
              { key: 'CORRESPONDENCE', label: 'Correspondence' },
              { key: 'OTHER', label: 'Other Documents' },
            ].map((folder) => {
              const count = folder.key === 'ALL'
                ? documents.length
                : folder.key === 'PLEADING'
                ? documents.filter(d => ['PLEADING', 'PETITION', 'WRITTEN_STATEMENT'].includes(d.category)).length
                : documents.filter(d => d.category === folder.key).length;

              return (
                <button
                  key={folder.key}
                  onClick={() => setDocumentCategoryFilter(folder.key)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: documentCategoryFilter === folder.key ? '#000000' : '#e4e4e7',
                    backgroundColor: documentCategoryFilter === folder.key ? '#000000' : '#ffffff',
                    color: documentCategoryFilter === folder.key ? '#ffffff' : '#000000',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconFolder size={14} /> {folder.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Documents Listing */}
          {(() => {
            const filteredDocs = documents.filter((doc) => {
              if (documentCategoryFilter === 'ALL') return true;
              if (documentCategoryFilter === 'PLEADING') {
                return ['PLEADING', 'PETITION', 'WRITTEN_STATEMENT'].includes(doc.category);
              }
              return doc.category === documentCategoryFilter;
            });

            if (filteredDocs.length === 0) {
              return (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                    <IconFolder size={36} color="var(--color-primary)" />
                  </div>
                  <h4>No Documents Found in this Folder</h4>
                  <p style={{ fontSize: '0.85rem' }}>
                    Click <strong>+ Upload Document</strong> to upload pleadings, orders, affidavits or applications.
                  </p>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                        <Link
                          to={`/cases/${id}/documents/${doc.id}`}
                          style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb', textDecoration: 'none' }}
                        >
                          {doc.title}
                        </Link>
                        <DocumentCategoryBadge category={doc.category} />
                        <ConfidentialityBadge level={doc.confidentiality_level} />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#1e293b',
                            backgroundColor: '#f1f5f9',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                          }}
                        >
                          v{doc.version_number || 1}
                        </span>
                      </div>

                      {doc.description && (
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#475569' }}>
                          {doc.description}
                        </p>
                      )}

                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        File: {doc.original_filename} • Modified {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link
                        to={`/cases/${id}/documents/${doc.id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Details & Preview
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2: HEARINGS */}
      {activeTab === 'HEARINGS' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Court Hearing Schedule & History</h2>
            <button onClick={() => setShowHearingModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              + Schedule Hearing
            </button>
          </div>

          {hearings.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No hearings scheduled for this case yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {hearings.map((h) => {
                const remState = expandedHearingReminders[h.id];
                const remData = remState?.data;

                return (
                  <div key={h.id} style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '1rem' }}>{new Date(h.hearingDate).toLocaleDateString()}</strong>
                          {h.hearingTime && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>at {h.hearingTime}</span>}
                          <span className="badge" style={{
                            fontSize: '0.75rem',
                            backgroundColor: h.status === 'SCHEDULED' ? '#ede9fe' : h.status === 'ADJOURNED' ? '#fef3c7' : 'var(--color-success-bg)',
                            color: h.status === 'SCHEDULED' ? '#6d28d9' : h.status === 'ADJOURNED' ? '#b45309' : 'var(--color-success)'
                          }}>
                            {h.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                          <strong>Purpose:</strong> {h.purpose || 'Court appearance'}
                        </div>

                        {(h.courtroom || h.judge) && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                            {h.courtroom && `Bench/Room: ${h.courtroom} `}
                            {h.judge && `\u2022 Coram: ${h.judge}`}
                          </div>
                        )}

                        {h.remarks && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                            Notes: {h.remarks}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleHearingReminders(h.id)}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.25rem 0.6rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            borderColor: remState?.isOpen ? 'var(--color-primary)' : undefined,
                            backgroundColor: remState?.isOpen ? '#eff6ff' : undefined,
                          }}
                        >
                          <IconPhone size={13} />
                          <span>WhatsApp Reminders</span>
                          <span style={{ fontSize: '0.65rem' }}>{remState?.isOpen ? '▲' : '▼'}</span>
                        </button>

                        {h.status === 'SCHEDULED' && (
                          <>
                            <button
                              onClick={() => { setSelectedHearingId(h.id); setShowAdjournModal(true); }}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                            >
                              Adjourn
                            </button>
                            <button
                              onClick={() => handleCancelHearing(h.id)}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', color: 'var(--color-danger)' }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Collapsible WhatsApp Reminders Panel */}
                    {remState?.isOpen && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '1rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                      }}>
                        {remState.loading ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                            Loading reminder schedule...
                          </div>
                        ) : remState.error ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', padding: '0.5rem' }}>
                            {remState.error}
                          </div>
                        ) : (
                          <div>
                            {/* Primary Client & Consent Banner */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.75rem',
                              paddingBottom: '0.75rem',
                              borderBottom: '1px solid var(--color-border)',
                              marginBottom: '0.75rem',
                            }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                                  Primary Case Client
                                </span>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                                  <span>{remData?.primaryClient?.name || 'No Client Associated'}</span>
                                  {remData?.primaryClient?.maskedPhone && (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                      ({remData.primaryClient.maskedPhone})
                                    </span>
                                  )}
                                  {remData?.primaryClient?.whatsappOptIn ? (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '12px',
                                      backgroundColor: '#ecfdf5',
                                      color: '#047857',
                                      border: '1px solid #a7f3d0',
                                      fontWeight: 600
                                    }}>
                                      Opted-In
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '12px',
                                      backgroundColor: '#fef3c7',
                                      color: '#b45309',
                                      border: '1px solid #fde68a',
                                      fontWeight: 600
                                    }}>
                                      Not Opted-In (Reminders Skipped)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {h.status === 'SCHEDULED' && (
                                  <>
                                    <button
                                      onClick={() => handleRegenerateReminders(h.id)}
                                      className="btn btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                      title="Recalculate and schedule reminders based on current settings"
                                    >
                                      Regenerate
                                    </button>
                                    <button
                                      onClick={() => setManualSendModal({
                                        isOpen: true,
                                        hearing: h,
                                        client: remData?.primaryClient,
                                        sending: false,
                                        error: '',
                                      })}
                                      disabled={!remData?.primaryClient?.whatsappOptIn}
                                      className="btn btn-primary"
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.6rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        opacity: remData?.primaryClient?.whatsappOptIn ? 1 : 0.6,
                                        cursor: remData?.primaryClient?.whatsappOptIn ? 'pointer' : 'not-allowed',
                                      }}
                                    >
                                      <IconPhone size={12} />
                                      <span>Send WhatsApp Reminder</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Reminders Table */}
                            {(!remData?.reminders || remData.reminders.length === 0) ? (
                              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '0.75rem' }}>
                                No WhatsApp reminders scheduled for this hearing.
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                                      <th style={{ padding: '0.4rem 0.3rem' }}>Reminder Type</th>
                                      <th style={{ padding: '0.4rem 0.3rem' }}>Scheduled For</th>
                                      <th style={{ padding: '0.4rem 0.3rem' }}>Status</th>
                                      <th style={{ padding: '0.4rem 0.3rem' }}>Delivery Details</th>
                                      <th style={{ padding: '0.4rem 0.3rem' }}>Notes / Reason</th>
                                      <th style={{ padding: '0.4rem 0.3rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {remData.reminders.map((rem) => {
                                      const statusColors = {
                                        SCHEDULED: { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
                                        PROCESSING: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
                                        SENT: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
                                        DELIVERED: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
                                        READ: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
                                        FAILED: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
                                        CANCELLED: { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' },
                                        SKIPPED: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
                                      };
                                      const badge = statusColors[rem.status] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };

                                      return (
                                        <tr key={rem.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '0.5rem 0.3rem', fontWeight: 500 }}>
                                            {rem.reminderType === 'HEARING_7_DAYS' ? '7 Days Before' :
                                             rem.reminderType === 'HEARING_3_DAYS' ? '3 Days Before' :
                                             rem.reminderType === 'HEARING_1_DAY' ? '1 Day Before' :
                                             rem.reminderType === 'HEARING_DAY' ? 'Day of Hearing' :
                                             rem.reminderType === 'MANUAL' ? 'Manual Send' : rem.reminderType}
                                            {rem.source === 'MANUAL' && (
                                              <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                                [MANUAL]
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.3rem', whiteSpace: 'nowrap' }}>
                                            {rem.scheduledAt ? new Date(rem.scheduledAt).toLocaleString('en-IN', {
                                              day: 'numeric',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            }) : '-'}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.3rem' }}>
                                            <span style={{
                                              padding: '0.15rem 0.4rem',
                                              borderRadius: '4px',
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              backgroundColor: badge.bg,
                                              color: badge.text,
                                              border: `1px solid ${badge.border}`,
                                            }}>
                                              {rem.status}
                                            </span>
                                          </td>
                                          <td style={{ padding: '0.5rem 0.3rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {rem.readAt ? (
                                              <span style={{ color: '#047857' }}>Read: {new Date(rem.readAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            ) : rem.deliveredAt ? (
                                              <span style={{ color: '#0369a1' }}>Delivered: {new Date(rem.deliveredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            ) : rem.sentAt ? (
                                              <span>Sent: {new Date(rem.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            ) : '-'}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.3rem', fontSize: '0.75rem', color: rem.status === 'FAILED' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                            {rem.failureReason || '-'}
                                          </td>
                                          <td style={{ padding: '0.5rem 0.3rem', textAlign: 'right' }}>
                                            {rem.status === 'SCHEDULED' && (
                                              <button
                                                onClick={() => handleCancelReminder(h.id, rem.id)}
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', color: 'var(--color-danger)' }}
                                              >
                                                Cancel
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: DEADLINES */}
      {activeTab === 'DEADLINES' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
                Statutory Limitation Deadlines
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                System calculations, trigger events, manual overrides, and 30/15/7/1-day alerts.
              </p>
            </div>

            {hasPermission('DEADLINE_CREATE') && (
              <button
                onClick={() => setShowDeadlineModal(true)}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
              >
                + Calculate / Add Deadline
              </button>
            )}
          </div>

          <DeadlineList
            caseId={id}
            deadlines={deadlines}
            onRefresh={fetchCaseDossier}
          />
        </div>
      )}

      {/* TAB 3: PARTIES */}
      {activeTab === 'PARTIES' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Parties to the Matter</h2>
            <button onClick={() => setShowPartyModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              + Add Party
            </button>
          </div>

          {(!caseData.parties || caseData.parties.length === 0) ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No parties registered. Link parties from existing chambers contacts.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {caseData.parties.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.displayName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Role: <strong>{p.partyRole}</strong> {p.partyDescription && `(${p.partyDescription})`}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveParty(p.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COUNSEL */}
      {activeTab === 'COUNSEL' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Case Advocates & Opposing Counsel</h2>
            <button onClick={() => setShowCounselModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              + Add Counsel
            </button>
          </div>

          {(!caseData.counsel || caseData.counsel.length === 0) ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No counsel recorded on this matter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {caseData.counsel.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.displayName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Type: <strong>{c.counselType}</strong> {c.notes && `(${c.notes})`}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveCounsel(c.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: NOTES */}
      {activeTab === 'NOTES' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Case Brief Notes & Strategy</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Confidential notes categorized by general, hearing, and internal strategy.</p>
            </div>
            <button onClick={() => setShowNoteModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              + Add Note
            </button>
          </div>

          {notes.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No notes logged for this case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notes.map((n) => (
                <div key={n.id} style={{
                  padding: '1rem',
                  backgroundColor: n.noteType === 'STRATEGY' || n.noteType === 'INTERNAL' ? '#fef3c7' : 'var(--color-bg-subtle)',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge" style={{ fontSize: '0.7rem' }}>{n.noteType}</span>
                      <strong>{n.title}</strong>
                    </div>
                    <button onClick={() => handleDeleteNote(n.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      Delete
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', whiteSpace: 'pre-wrap', marginTop: '0.3rem' }}>
                    {n.content}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                    Author: {n.authorName} &bull; {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ASSIGNMENTS */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Assigned Chambers Legal Team</h2>
            {hasPermission('CASE_ASSIGN') && (
              <button onClick={() => setShowAssignModal(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                + Assign Advocate
              </button>
            )}
          </div>

          {(!caseData.assignments || caseData.assignments.length === 0) ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No advocates assigned. Assign junior or senior associates to grant access to this case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {caseData.assignments.map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Role: <strong>{a.roleInCase}</strong> &bull; Assigned by: {a.assignedBy}
                    </div>
                  </div>
                  {hasPermission('CASE_ASSIGN') && (
                    <button onClick={() => handleUnassignUser(a.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      Unassign
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD PARTY */}
      {showPartyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>Add Case Party</h2>
            <form onSubmit={handleAddParty} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact Profile</label>
                <select
                  required
                  value={partyForm.contact_id}
                  onChange={(e) => setPartyForm({ ...partyForm, contact_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Party Role</label>
                <select
                  value={partyForm.party_role}
                  onChange={(e) => setPartyForm({ ...partyForm, party_role: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="PLAINTIFF">Plaintiff</option>
                  <option value="DEFENDANT">Defendant</option>
                  <option value="PETITIONER">Petitioner</option>
                  <option value="RESPONDENT">Respondent</option>
                  <option value="APPELLANT">Appellant</option>
                  <option value="COMPLAINANT">Complainant</option>
                  <option value="ACCUSED">Accused</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Party Designation (e.g. Respondent No. 1)</label>
                <input
                  type="text"
                  value={partyForm.party_description}
                  onChange={(e) => setPartyForm({ ...partyForm, party_description: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowPartyModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Party</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD COUNSEL */}
      {showCounselModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>Record Counsel</h2>
            <form onSubmit={handleAddCounsel} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Advocate Contact</label>
                <select
                  required
                  value={counselForm.contact_id}
                  onChange={(e) => setCounselForm({ ...counselForm, contact_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="">-- Choose Advocate Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName} ({c.organizationName || 'Bar'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Counsel Type</label>
                <select
                  value={counselForm.counsel_type}
                  onChange={(e) => setCounselForm({ ...counselForm, counsel_type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="OPPOSING_COUNSEL">Opposing Counsel</option>
                  <option value="OUR_COUNSEL">Briefed Senior / Outside Counsel</option>
                  <option value="OTHER_COUNSEL">Other Counsel</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Notes / Bar Registration</label>
                <input
                  type="text"
                  placeholder="e.g. D/123/2012"
                  value={counselForm.notes}
                  onChange={(e) => setCounselForm({ ...counselForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCounselModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Counsel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN USER */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>Assign Advocate to Case</h2>
            <form onSubmit={handleAssignUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Chambers User</label>
                <select
                  required
                  value={assignForm.user_id}
                  onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="">-- Choose Associate --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.roles?.[0] || 'Associate'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Role in Case</label>
                <select
                  value={assignForm.role_in_case}
                  onChange={(e) => setAssignForm({ ...assignForm, role_in_case: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="LEAD_COUNSEL">Lead Counsel</option>
                  <option value="ARGUING_COUNSEL">Arguing Counsel</option>
                  <option value="BRIEFING_ASSOCIATE">Briefing Associate</option>
                  <option value="RESEARCH_ASSOCIATE">Research Associate</option>
                  <option value="ASSIGNED_ASSOCIATE">General Assigned Associate</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NOTE */}
      {showNoteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>Add Case Note</h2>
            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Note Classification</label>
                <select
                  value={noteForm.note_type}
                  onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                >
                  <option value="GENERAL">General Brief Note</option>
                  <option value="HEARING">Hearing Debrief / Outcome</option>
                  <option value="STRATEGY">Confidential Legal Strategy (Privileged)</option>
                  <option value="CLIENT">Client Communication Note</option>
                  <option value="INTERNAL">Internal Chambers Administrative Note</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Note Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Interim injunction argument outline"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Content</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Detailed notes, legal authorities cited, judge remarks..."
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowNoteModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Note</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SCHEDULE HEARING */}
      {showHearingModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>Schedule Court Hearing Date</h2>
            <form onSubmit={handleCreateHearing} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hearing Date</label>
                  <input
                    type="date"
                    required
                    value={hearingForm.hearing_date}
                    onChange={(e) => setHearingForm({ ...hearingForm, hearing_date: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hearing Time (Optional)</label>
                  <input
                    type="time"
                    value={hearingForm.hearing_time}
                    onChange={(e) => setHearingForm({ ...hearingForm, hearing_time: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Purpose / Stage of Hearing</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Final Arguments or Evidence Cross-Examination"
                  value={hearingForm.purpose}
                  onChange={(e) => setHearingForm({ ...hearingForm, purpose: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Courtroom / Bench</label>
                  <input
                    type="text"
                    placeholder="e.g. Court No. 4"
                    value={hearingForm.courtroom}
                    onChange={(e) => setHearingForm({ ...hearingForm, courtroom: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hon'ble Judge(s)</label>
                  <input
                    type="text"
                    placeholder="Coram details"
                    value={hearingForm.judge}
                    onChange={(e) => setHearingForm({ ...hearingForm, judge: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowHearingModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Hearing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADJOURN HEARING */}
      {showAdjournModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>Adjourn Court Hearing</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              An immutable adjournment record will be created and the next hearing date will be automatically synchronized.
            </p>
            <form onSubmit={handleAdjournSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>New Adjourned Date</label>
                  <input
                    type="date"
                    required
                    value={adjournForm.new_date}
                    onChange={(e) => setAdjournForm({ ...adjournForm, new_date: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Time (Optional)</label>
                  <input
                    type="time"
                    value={adjournForm.new_time}
                    onChange={(e) => setAdjournForm({ ...adjournForm, new_time: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason for Adjournment</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Counter affidavit awaited from respondent"
                  value={adjournForm.reason}
                  onChange={(e) => setAdjournForm({ ...adjournForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Requested By</label>
                <input
                  type="text"
                  placeholder="e.g. Counsel for Union of India or Court suo motu"
                  value={adjournForm.requested_by}
                  onChange={(e) => setAdjournForm({ ...adjournForm, requested_by: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAdjournModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#b45309', borderColor: '#b45309' }}>
                  Execute Adjournment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CALCULATE / ADD LIMITATION DEADLINE */}
      {showDeadlineModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '8px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <DeadlineCalculator
              caseId={id}
              onClose={() => setShowDeadlineModal(false)}
              onSuccess={() => {
                setShowDeadlineModal(false);
                fetchCaseDossier();
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL: MANUAL SEND WHATSAPP REMINDER */}
      {manualSendModal.isOpen && manualSendModal.hearing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconPhone size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                  Send WhatsApp Hearing Reminder
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Official WhatsApp Business Cloud API
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Send hearing reminder to this client?
            </p>

            <div style={{
              backgroundColor: 'var(--color-bg-subtle)',
              padding: '0.85rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}>
              <div>
                <strong>Client:</strong> {manualSendModal.client?.name || 'Primary Client'}
                {manualSendModal.client?.maskedPhone && (
                  <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>
                    ({manualSendModal.client.maskedPhone})
                  </span>
                )}
              </div>
              <div>
                <strong>Case Number:</strong> {caseData?.caseNumber || 'N/A'}
              </div>
              <div>
                <strong>Hearing Date & Time:</strong> {new Date(manualSendModal.hearing.hearingDate).toLocaleDateString()}{manualSendModal.hearing.hearingTime ? ` at ${manualSendModal.hearing.hearingTime}` : ''}
              </div>
              <div>
                <strong>Court:</strong> {manualSendModal.hearing.courtName || caseData?.court?.name || 'Designated Court'}
              </div>
              <div>
                <strong>Purpose:</strong> {manualSendModal.hearing.purpose || 'Court appearance'}
              </div>
            </div>

            <div style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              marginBottom: '1rem',
              borderLeft: '3px solid #10b981',
              paddingLeft: '0.6rem'
            }}>
              Template: <code>case_hearing_reminder</code> (English). This manual dispatch will be recorded in the chambers audit trail with source <code>MANUAL</code>.
            </div>

            {manualSendModal.error && (
              <div style={{
                padding: '0.6rem 0.8rem',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {manualSendModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={manualSendModal.sending}
                onClick={() => setManualSendModal({ isOpen: false, hearing: null, client: null, sending: false, error: '' })}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={manualSendModal.sending}
                onClick={handleConfirmManualSend}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {manualSendModal.sending ? (
                  <span>Dispatching...</span>
                ) : (
                  <>
                    <IconPhone size={14} />
                    <span>Confirm & Send Reminder</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CaseDetailPage;
