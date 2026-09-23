import React, { useState, useEffect } from "react";
import documentService from "../../services/documentService";
import { IconLock, IconX, IconShare, IconAlertTriangle } from "../common/Icons";

const DocumentShareModal = ({ documentId, documentTitle, isOpen, onClose }) => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [sharedWithUserId, setSharedWithUserId] = useState("");
  const [permission, setPermission] = useState("VIEW");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (isOpen && documentId) {
      fetchShares();
    }
  }, [isOpen, documentId]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await documentService.getShares(documentId);
      if (res.success) {
        setShares(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async (e) => {
    e.preventDefault();
    if (!sharedWithUserId) {
      setError("Please provide user ID to share with.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      shared_with_user_id: parseInt(sharedWithUserId, 10),
      permission,
      expires_at: expiresAt ? new Date(expiresAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    };

    try {
      const res = await documentService.createShare(documentId, payload);
      if (res.success) {
        setSharedWithUserId("");
        setExpiresAt("");
        fetchShares();
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!window.confirm("Revoke this internal share? The colleague will immediately lose access.")) return;
    try {
      await documentService.revokeShare(documentId, shareId);
      fetchShares();
    } catch (err) {
      alert("Failed to revoke: " + (err.response?.data?.message || err.message));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "620px" }}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#09090b" }}>
              Internal Document Sharing
            </h2>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "#71717a" }}>
              {documentTitle}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              backgroundColor: "#f4f4f5",
              border: "1px solid #e4e4e7",
              padding: "0.75rem 1rem",
              borderRadius: "6px",
              marginBottom: "1.25rem",
              fontSize: "0.82rem",
              color: "#09090b",
              lineHeight: 1.45,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
              <IconLock size={14} color="#000000" /> Security Policy:
            </span>{" "}
            Documents are confidential. Shares are restricted to authenticated chambers colleagues and cannot be accessed publicly or anonymously.
          </div>


        {error && (
          <div
            style={{
              backgroundColor: "#000000",
              color: "#ffffff",
              padding: "0.6rem",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Existing Shares */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Active & Past Shares ({shares.length})
          </h4>
          {loading ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Loading shares...</p>
          ) : shares.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>
              Not shared with any colleagues yet.
            </p>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Colleague</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Access</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Revoke</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <strong>{s.recipient_first_name} {s.recipient_last_name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{s.recipient_email}</div>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span
                          style={{
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {s.permission}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {s.is_active ? (
                          <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.75rem" }}>Active</span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Revoked / Expired</span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                        {s.is_active ? (
                          <button
                            onClick={() => handleRevokeShare(s.id)}
                            style={{
                              color: "#ef4444",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Revoke
                          </button>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Share Form */}
        <form
          onSubmit={handleCreateShare}
          style={{
            backgroundColor: "#f8fafc",
            padding: "1rem",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            Share With Colleague
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Colleague User ID *
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 3"
                value={sharedWithUserId}
                onChange={(e) => setSharedWithUserId(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Access Permission
              </label>
              <select
                className="form-control"
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
              >
                <option value="VIEW">VIEW (Preview & Read)</option>
                <option value="DOWNLOAD">DOWNLOAD (Save File)</option>
                <option value="EDIT">EDIT (Update & Revise)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Optional Expiration Date
            </label>
            <input
              type="datetime-local"
              className="form-control"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
              disabled={submitting}
            >
              {submitting ? "Sharing..." : "Grant Internal Share"}
            </button>
          </div>
        </form>
      </div>

      <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentShareModal;
