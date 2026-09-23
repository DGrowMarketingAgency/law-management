import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../services/api";
import { useAuth } from "../context/AuthContext";

const Users = () => {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");

  // New User Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "JUNIOR_ASSOCIATE",
    initialPassword: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/users");
      if (res.data?.success) {
        setUsers(res.data.data.users);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load chambers users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setModalSuccess("");

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
      };

      if (formData.initialPassword) {
        payload.initialPassword = formData.initialPassword;
      }

      const res = await apiClient.post("/users", payload);
      if (res.data?.success) {
        const createdUser = res.data.data.user;
        let successMsg = `User ${createdUser.firstName} ${createdUser.lastName} successfully created.`;
        if (createdUser.invitationToken) {
          successMsg += ` Invitation Token: ${createdUser.invitationToken}`;
        }
        setModalSuccess(successMsg);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          role: "JUNIOR_ASSOCIATE",
          initialPassword: "",
        });
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusToggle = async (user) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!window.confirm(`Are you sure you want to change status of ${user.firstName} to ${newStatus}?`)) {
      return;
    }

    try {
      await apiClient.patch(`/users/${user.id}/status`, { status: newStatus });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="card-title" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
            Chambers User & Access Management
          </h1>
          <p className="card-subtitle" style={{ marginBottom: 0 }}>
            Manage advocates, junior associates, and client accounts with Role-Based Access Control (RBAC).
          </p>
        </div>

        {hasPermission("USER_CREATE") && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            + Add / Invite Associate
          </button>
        )}
      </div>

      {error && (
        <div className="status-badge disconnected" style={{ width: "100%", marginBottom: "1.25rem", padding: "0.75rem" }}>
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="card table-card-scroll" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Name</th>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Email</th>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Role</th>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Status</th>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>2FA</th>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Last Login</th>
              <th style={{ padding: "0.75rem 1rem", fontWeight: 600, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
                  Loading chambers associates...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
                  No users found in chambers registry.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                    {u.firstName} {u.lastName}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--color-secondary)" }}>
                    {u.email}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: u.roles.includes("OWNER") ? "#fef3c7" : "#e0f2fe",
                        color: u.roles.includes("OWNER") ? "#92400e" : "#0369a1",
                      }}
                    >
                      {u.roles.join(", ") || "No Role"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: u.status === "ACTIVE" ? "var(--color-success-bg)" : "#fee2e2",
                        color: u.status === "ACTIVE" ? "var(--color-success)" : "var(--color-danger)",
                      }}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    {u.twoFactorEnabled ? (
                      <span style={{ color: "var(--color-success)", fontWeight: 600 }}>Enabled</span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>Off</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    {!u.roles.includes("OWNER") && hasPermission("USER_DISABLE") && (
                      <button
                        onClick={() => handleStatusToggle(u)}
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Invite User Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: "480px", maxWidth: "90%", padding: "2rem" }}>
            <h2 className="card-title">Invite / Add Chambers User</h2>
            <p className="card-subtitle">Create an account for an associate or client.</p>

            {modalSuccess && (
              <div style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success)", padding: "0.75rem", borderRadius: "4px", fontSize: "0.85rem", marginBottom: "1rem" }}>
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="associate@chambers.in"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Role *</label>
                <select
                  className="form-input"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="SENIOR_ASSOCIATE">Senior Associate</option>
                  <option value="JUNIOR_ASSOCIATE">Junior Associate</option>
                  <option value="CLIENT">Client</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Initial Password (Optional)</label>
                <input
                  type="password"
                  className="form-input"
                  value={formData.initialPassword}
                  onChange={(e) => setFormData({ ...formData, initialPassword: e.target.value })}
                  placeholder="Leave blank to generate an invitation link"
                />
                <small style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                  If provided, must have at least 8 chars with uppercase, lowercase, and number.
                </small>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setModalSuccess("");
                  }}
                >
                  Close
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
