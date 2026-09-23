import React, { useState, useEffect } from "react";
import documentService from "../../services/documentService";
import { IconX, IconShield, IconAlertTriangle } from "../common/Icons";

const DocumentPermissionsModal = ({ documentId, documentTitle, isOpen, onClose }) => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [targetType, setTargetType] = useState("USER"); // USER or ROLE
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRoleId, setTargetRoleId] = useState("3"); // e.g. JUNIOR_ASSOCIATE
  const [permissionAction, setPermissionAction] = useState("VIEW");

  useEffect(() => {
    if (isOpen && documentId) {
      fetchPermissions();
    }
  }, [isOpen, documentId]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await documentService.getPermissions(documentId);
      if (res.success) {
        setPermissions(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      permission: permissionAction,
      target_user_id: targetType === "USER" ? parseInt(targetUserId, 10) : null,
      target_role_id: targetType === "ROLE" ? parseInt(targetRoleId, 10) : null,
    };

    try {
      const res = await documentService.grantPermission(documentId, payload);
      if (res.success) {
        setTargetUserId("");
        fetchPermissions();
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (permissionId) => {
    if (!window.confirm("Are you sure you want to revoke this permission?")) return;
    try {
      await documentService.revokePermission(documentId, permissionId);
      fetchPermissions();
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
        style={{ maxWidth: "650px" }}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#09090b" }}>
              Document Access Control (Permissions)
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

        {error && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              padding: "0.6rem",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Existing Permissions List */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Active Explicit Permissions ({permissions.length})
          </h4>
          {loading ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Loading permissions...</p>
          ) : permissions.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>
              No explicit override permissions configured. Access follows default case assignments and role permissions.
            </p>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Entity</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Action</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Granted By</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Revoke</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {p.user_id ? (
                          <span>
                            <strong>User:</strong> {p.user_first_name} {p.user_last_name} ({p.user_email})
                          </span>
                        ) : (
                          <span>
                            <strong>Role:</strong> {p.role_name}
                          </span>
                        )}
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
                          {p.permission}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#64748b" }}>
                        {p.granter_first_name} {p.granter_last_name}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                        <button
                          onClick={() => handleRevoke(p.id)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Grant New Permission */}
        <form
          onSubmit={handleGrant}
          style={{
            backgroundColor: "#f8fafc",
            padding: "1rem",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
            Grant Explicit Permission
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Target Type
              </label>
              <select
                className="form-control"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              >
                <option value="USER">Specific User ID</option>
                <option value="ROLE">Chambers Role</option>
              </select>
            </div>

            {targetType === "USER" ? (
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  User ID *
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 5"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Role *
                </label>
                <select
                  className="form-control"
                  value={targetRoleId}
                  onChange={(e) => setTargetRoleId(e.target.value)}
                >
                  <option value="1">OWNER</option>
                  <option value="2">SENIOR_ASSOCIATE</option>
                  <option value="3">JUNIOR_ASSOCIATE</option>
                  <option value="4">CLIENT</option>
                </select>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Permission Action
              </label>
              <select
                className="form-control"
                value={permissionAction}
                onChange={(e) => setPermissionAction(e.target.value)}
              >
                <option value="VIEW">VIEW</option>
                <option value="DOWNLOAD">DOWNLOAD</option>
                <option value="EDIT">EDIT</option>
                <option value="UPLOAD_VERSION">UPLOAD_VERSION</option>
                <option value="DELETE">DELETE</option>
                <option value="SHARE">SHARE</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
              disabled={submitting}
            >
              {submitting ? "Granting..." : "Grant Permission"}
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

export default DocumentPermissionsModal;
