import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  IconUser,
  IconShield,
  IconKey,
  IconLock,
  IconCheck,
  IconAlertTriangle,
  IconPhone,
  IconBriefcase,
  IconCourthouse,
  IconClock,
  IconFolder,
  IconScale,
} from "../components/common/Icons";

const ProfilePage = () => {
  const {
    user,
    updateProfile,
    changePassword,
    requestEnable2FA,
    confirmEnable2FA,
    disable2FA,
    logout,
  } = useAuth();

  const [activeTab, setActiveTab] = useState("PROFILE"); // 'PROFILE' | 'SECURITY' | 'PERMISSIONS' | 'SESSIONS'

  // Personal Info Form
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    barEnrollment: "TN/4892/2016",
    chambersDesignation: "Advocate & Counsel",
    primaryCourt: "High Court of Judicature at Madras",
    specialization: "Civil Litigation & Commercial Arbitration",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Security: Change Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // 2FA Management State
  const [showEnable2FAModal, setShowEnable2FAModal] = useState(false);
  const [enable2FAOtp, setEnable2FAOtp] = useState("");
  const [enable2FASubmitting, setEnable2FASubmitting] = useState(false);
  const [enable2FAError, setEnable2FAError] = useState(null);

  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disable2FASubmitting, setDisable2FASubmitting] = useState(false);
  const [disable2FAError, setDisable2FAError] = useState(null);

  // Sync profile data on mount or user change
  useEffect(() => {
    if (user) {
      setProfileForm((prev) => ({
        ...prev,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      await updateProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
      });
      setProfileMessage("Your profile information has been updated successfully.");
    } catch (err) {
      setProfileError(err.response?.data?.message || err.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage(null);
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      setPasswordSaving(false);
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage(res.message || "Password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err.response?.data?.message || err.message || "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  // 2FA Enable Handlers
  const handleStartEnable2FA = async () => {
    setEnable2FAError(null);
    setEnable2FAOtp("");
    try {
      await requestEnable2FA();
      setShowEnable2FAModal(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to initiate 2FA.");
    }
  };

  const handleConfirm2FA = async (e) => {
    e.preventDefault();
    setEnable2FASubmitting(true);
    setEnable2FAError(null);

    try {
      await confirmEnable2FA(enable2FAOtp);
      setShowEnable2FAModal(false);
      setEnable2FAOtp("");
      alert("Two-Factor Authentication has been successfully enabled for your chambers account!");
    } catch (err) {
      setEnable2FAError(err.response?.data?.message || err.message || "Invalid OTP code.");
    } finally {
      setEnable2FASubmitting(false);
    }
  };

  // 2FA Disable Handlers
  const handleConfirmDisable2FA = async (e) => {
    e.preventDefault();
    setDisable2FASubmitting(true);
    setDisable2FAError(null);

    try {
      await disable2FA(disablePassword);
      setShowDisable2FAModal(false);
      setDisablePassword("");
      alert("Two-Factor Authentication has been disabled.");
    } catch (err) {
      setDisable2FAError(err.response?.data?.message || err.message || "Failed to disable 2FA. Incorrect password.");
    } finally {
      setDisable2FASubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="card" style={{ padding: "3rem", textAlign: "center", color: "#71717a" }}>
        Loading account details...
      </div>
    );
  }

  // Permission Categories for RBAC tab
  const permissionCategories = [
    {
      category: "Case & Court Management",
      icon: <IconScale size={16} />,
      perms: ["CASE_VIEW", "CASE_CREATE", "CASE_UPDATE", "CASE_DELETE", "HEARING_MANAGE", "CAUSELIST_VIEW"],
    },
    {
      category: "Document Repository & Files",
      icon: <IconFolder size={16} />,
      perms: ["DOCUMENT_VIEW", "DOCUMENT_UPLOAD", "DOCUMENT_EDIT", "DOCUMENT_DELETE", "DOCUMENT_SHARE", "DOCUMENT_CONFIDENTIAL"],
    },
    {
      category: "Limitation Act Deadlines",
      icon: <IconClock size={16} />,
      perms: ["DEADLINE_VIEW", "DEADLINE_CREATE", "DEADLINE_OVERRIDE", "DEADLINE_RULE_MANAGE", "DEADLINE_DISPATCH"],
    },
    {
      category: "Chambers CRM & Directory",
      icon: <IconBriefcase size={16} />,
      perms: ["CONTACT_VIEW", "CONTACT_CREATE", "CONTACT_UPDATE", "CLIENT_VIEW", "LEAD_VIEW", "LEAD_CONVERT"],
    },
    {
      category: "Chambers Administration",
      icon: <IconShield size={16} />,
      perms: ["USER_VIEW", "USER_CREATE", "USER_UPDATE", "USER_DISABLE", "USER_ROLE_UPDATE", "COURT_VIEW", "COURT_MANAGE"],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 1. ADVOCATE ACCOUNT HERO CARD */}
      <div className="card" style={{ padding: "1.75rem", marginBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            {/* Monochromatic Inverted Avatar */}
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                backgroundColor: "#000000",
                color: "#ffffff",
                border: "2px solid #000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.85rem",
                fontWeight: 800,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                flexShrink: 0,
              }}
            >
              {user.firstName?.[0] || "A"}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#000000", margin: 0 }}>
                  {user.firstName} {user.lastName}
                </h1>
                <span
                  style={{
                    backgroundColor: "#000000",
                    color: "#ffffff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "4px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {user.roles?.[0] || "ADVOCATE"}
                </span>
                <span
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    border: "1px solid #000000",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "4px",
                  }}
                >
                  {user.status || "ACTIVE"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", color: "#71717a", fontSize: "0.85rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                <span>{user.email}</span>
                <span>&bull;</span>
                <span>{user.phone ? `+91 ${user.phone}` : "No phone registered"}</span>
                <span>&bull;</span>
                <span>Chambers ID: #{user.id}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.3rem 0.6rem",
                borderRadius: "4px",
                backgroundColor: user.twoFactorEnabled ? "#ffffff" : "#f4f4f5",
                color: "#000000",
                border: "1px solid #000000",
              }}
            >
              {user.twoFactorEnabled ? (
                <>
                  <IconCheck size={12} /> 2FA Active
                </>
              ) : (
                <>
                  <IconAlertTriangle size={12} /> 2FA Inactive
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. PROFILE TAB NAVIGATION */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #e4e4e7" }}>
        <button
          onClick={() => setActiveTab("PROFILE")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "PROFILE" ? "2px solid #000000" : "2px solid transparent",
            color: activeTab === "PROFILE" ? "#000000" : "#71717a",
            fontWeight: activeTab === "PROFILE" ? 700 : 500,
            cursor: "pointer",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <IconUser size={16} /> Personal & Practice Profile
        </button>

        <button
          onClick={() => setActiveTab("SECURITY")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "SECURITY" ? "2px solid #000000" : "2px solid transparent",
            color: activeTab === "SECURITY" ? "#000000" : "#71717a",
            fontWeight: activeTab === "SECURITY" ? 700 : 500,
            cursor: "pointer",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <IconKey size={16} /> Security & 2FA
        </button>

        <button
          onClick={() => setActiveTab("PERMISSIONS")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "PERMISSIONS" ? "2px solid #000000" : "2px solid transparent",
            color: activeTab === "PERMISSIONS" ? "#000000" : "#71717a",
            fontWeight: activeTab === "PERMISSIONS" ? 700 : 500,
            cursor: "pointer",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <IconShield size={16} /> Roles & Permissions (RBAC)
        </button>

        <button
          onClick={() => setActiveTab("SESSIONS")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "SESSIONS" ? "2px solid #000000" : "2px solid transparent",
            color: activeTab === "SESSIONS" ? "#000000" : "#71717a",
            fontWeight: activeTab === "SESSIONS" ? 700 : 500,
            cursor: "pointer",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <IconClock size={16} /> Sessions & Audit
        </button>
      </div>

      {/* 3. TAB 1: PERSONAL & PRACTICE DETAILS */}
      {activeTab === "PROFILE" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "1.5rem" }}>
          {/* Left Form */}
          <div className="card">
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem", color: "#000000" }}>
              Personal & Chambers Information
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Update your advocate display credentials and phone number. Official email changes require Chambers Owner approval.
            </p>

            {profileMessage && (
              <div style={{ padding: "0.75rem 1rem", backgroundColor: "#f4f4f5", border: "1px solid #000000", color: "#000000", borderRadius: "4px", marginBottom: "1.25rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconCheck size={16} /> {profileMessage}
              </div>
            )}

            {profileError && (
              <div style={{ padding: "0.75rem 1rem", backgroundColor: "#000000", color: "#ffffff", borderRadius: "4px", marginBottom: "1.25rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconAlertTriangle size={16} color="#ffffff" /> {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address (Read-Only)</label>
                <input
                  type="email"
                  disabled
                  className="form-input"
                  value={user.email}
                  style={{ backgroundColor: "#f4f4f5", color: "#71717a", cursor: "not-allowed" }}
                />
                <span style={{ fontSize: "0.75rem", color: "#71717a", marginTop: "0.25rem", display: "block" }}>
                  Used for system authentication, case alerts, and limitation deadline dispatches.
                </span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Primary Mobile / Phone</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 9840123456"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Bar Council Enrollment No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.barEnrollment}
                    onChange={(e) => setProfileForm({ ...profileForm, barEnrollment: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Chambers Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.chambersDesignation}
                    onChange={(e) => setProfileForm({ ...profileForm, chambersDesignation: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Principal Court / Jurisdiction</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileForm.primaryCourt}
                  onChange={(e) => setProfileForm({ ...profileForm, primaryCourt: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Practice Specialization</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileForm.specialization}
                  onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="btn btn-primary"
                  style={{ minWidth: "140px" }}
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Chambers Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="card">
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "#000000" }}>
                Chambers Summary
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e4e4e7", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "#71717a" }}>Chambers Role</span>
                  <strong>{user.roles?.join(", ") || "Advocate"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e4e4e7", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "#71717a" }}>Account Status</span>
                  <span style={{ fontWeight: 700, color: "#000000" }}>{user.status || "ACTIVE"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e4e4e7", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "#71717a" }}>Member Since</span>
                  <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active Member"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#71717a" }}>Two-Factor Security</span>
                  <span style={{ fontWeight: 700, color: "#000000" }}>
                    {user.twoFactorEnabled ? "Active & Enforced" : "Not Enabled"}
                  </span>
                </div>
              </div>
            </div>

            <div className="card" style={{ backgroundColor: "#f4f4f5" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <IconShield size={18} />
                <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Advocate Confidentiality Note</h4>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#52525b", lineHeight: 1.4, margin: 0 }}>
                All document repository accesses, limitation deadline changes, and court appearances
                are cryptographically logged for chambers compliance under the Advocates Act and Evidence provisions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: SECURITY & TWO-FACTOR AUTHENTICATION */}
      {activeTab === "SECURITY" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
          {/* Change Password Panel */}
          <div className="card">
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem", color: "#000000" }}>
              Change Account Password
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Ensure your chambers account uses a strong, unique password to prevent unauthorized matter access.
            </p>

            {passwordMessage && (
              <div style={{ padding: "0.75rem 1rem", backgroundColor: "#f4f4f5", border: "1px solid #000000", color: "#000000", borderRadius: "4px", marginBottom: "1.25rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconCheck size={16} /> {passwordMessage}
              </div>
            )}

            {passwordError && (
              <div style={{ padding: "0.75rem 1rem", backgroundColor: "#000000", color: "#ffffff", borderRadius: "4px", marginBottom: "1.25rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconAlertTriangle size={16} color="#ffffff" /> {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Current Password *</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">New Password * (Min. 8 characters)</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="btn btn-primary"
                  style={{ minWidth: "160px" }}
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Two-Factor Authentication Panel */}
          <div className="card">
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem", color: "#000000" }}>
              Two-Factor Authentication (2FA)
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              Adds an essential layer of security. When enabled, signing in requires your password and a one-time passcode (OTP).
            </p>

            <div
              style={{
                padding: "1rem",
                borderRadius: "6px",
                border: "1px solid #e4e4e7",
                backgroundColor: "#f4f4f5",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#000000" }}>
                    Status: {user.twoFactorEnabled ? "ENABLED" : "DISABLED"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: "0.2rem" }}>
                    {user.twoFactorEnabled
                      ? "Your account is protected with two-factor authentication."
                      : "We strongly recommend enabling 2FA for advocate confidential data protection."}
                  </div>
                </div>

                <span
                  style={{
                    backgroundColor: user.twoFactorEnabled ? "#000000" : "#ffffff",
                    color: user.twoFactorEnabled ? "#ffffff" : "#000000",
                    border: "1px solid #000000",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "4px",
                  }}
                >
                  {user.twoFactorEnabled ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>

            {user.twoFactorEnabled ? (
              <div>
                <button
                  onClick={() => {
                    setDisablePassword("");
                    setDisable2FAError(null);
                    setShowDisable2FAModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ borderColor: "#000000" }}
                >
                  Disable Two-Factor Authentication
                </button>
              </div>
            ) : (
              <div>
                <button onClick={handleStartEnable2FA} className="btn btn-primary">
                  Set Up Two-Factor Authentication
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 3: ROLES & RBAC PERMISSIONS */}
      {activeTab === "PERMISSIONS" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#000000", margin: "0 0 0.25rem 0" }}>
                Role-Based Access Control (RBAC) Matrix
              </h2>
              <p style={{ color: "#71717a", fontSize: "0.85rem", margin: 0 }}>
                Permissions assigned to your account based on your chambers role ({user.roles?.join(", ") || "Advocate"}).
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {user.roles?.map((r) => (
                <span key={r} style={{ backgroundColor: "#000000", color: "#ffffff", padding: "0.3rem 0.75rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700 }}>
                  ROLE: {r}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {permissionCategories.map((cat) => (
              <div
                key={cat.category}
                style={{
                  border: "1px solid #e4e4e7",
                  borderRadius: "6px",
                  padding: "1rem",
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.9rem", color: "#000000", marginBottom: "0.75rem", borderBottom: "1px solid #f4f4f5", paddingBottom: "0.5rem" }}>
                  {cat.icon}
                  <span>{cat.category}</span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {cat.perms.map((p) => {
                    const hasP = user.isOwner || user.roles?.includes("OWNER") || user.permissions?.includes(p);
                    return (
                      <span
                        key={p}
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          border: hasP ? "1px solid #000000" : "1px dashed #d4d4d8",
                          backgroundColor: hasP ? "#f4f4f5" : "#ffffff",
                          color: hasP ? "#000000" : "#a1a1aa",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        {hasP ? <IconCheck size={10} color="#000000" /> : null}
                        {p}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB 4: ACTIVE SESSIONS & SECURITY AUDIT */}
      {activeTab === "SESSIONS" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem", color: "#000000" }}>
              Active Chambers Session
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              Details of your current authenticated workstation session.
            </p>

            <div style={{ border: "1px solid #e4e4e7", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ padding: "1rem", backgroundColor: "#f4f4f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.9rem", color: "#000000" }}>Current Desktop Workstation</strong>
                  <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Session Active &bull; JWT Token Valid</div>
                </div>
                <span style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "3px" }}>
                  THIS DEVICE
                </span>
              </div>
              <div style={{ padding: "1rem", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#71717a" }}>Authentication Standard:</span>
                  <strong>JWT + HttpOnly Refresh Token</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#71717a" }}>Role Authorization:</span>
                  <strong>{user.roles?.join(", ") || "Advocate"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#71717a" }}>Last Login:</span>
                  <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Current Session"}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <button onClick={logout} className="btn btn-secondary" style={{ color: "#000000", borderColor: "#000000" }}>
                Terminate All Other Sessions & Log Out
              </button>
            </div>
          </div>

          <div className="card" style={{ backgroundColor: "#f4f4f5" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "#000000" }}>
              Security & Privacy Policy
            </h3>
            <ul style={{ fontSize: "0.82rem", color: "#52525b", paddingLeft: "1.2rem", lineHeight: 1.6, margin: 0 }}>
              <li>Sessions automatically expire upon prolonged inactivity.</li>
              <li>Passwords are hashed with bcrypt (cost factor 12).</li>
              <li>Limitation calculations and document downloads are auditable under Indian law.</li>
              <li>Do not share your credentials with unauthorized third parties.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 2FA ENABLE MODAL */}
      {showEnable2FAModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
          <div className="card" style={{ maxWidth: "440px", width: "100%", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Confirm Two-Factor Setup</h2>
              <button onClick={() => setShowEnable2FAModal(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>&times;</button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#71717a", marginBottom: "1rem" }}>
              A 6-digit one-time verification code has been dispatched to your registered email ({user.email}).
            </p>

            {enable2FAError && (
              <div style={{ padding: "0.6rem", backgroundColor: "#000000", color: "#ffffff", borderRadius: "4px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {enable2FAError}
              </div>
            )}

            <form onSubmit={handleConfirm2FA} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Enter 6-Digit OTP Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  className="form-input"
                  placeholder="e.g. 123456"
                  value={enable2FAOtp}
                  onChange={(e) => setEnable2FAOtp(e.target.value)}
                  style={{ textAlign: "center", letterSpacing: "3px", fontSize: "1.1rem", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowEnable2FAModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={enable2FASubmitting} className="btn btn-primary">
                  {enable2FASubmitting ? "Verifying..." : "Verify & Activate 2FA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA DISABLE MODAL */}
      {showDisable2FAModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
          <div className="card" style={{ maxWidth: "440px", width: "100%", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Disable Two-Factor Authentication</h2>
              <button onClick={() => setShowDisable2FAModal(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>&times;</button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#71717a", marginBottom: "1rem" }}>
              Please enter your account password to confirm disabling two-factor authentication.
            </p>

            {disable2FAError && (
              <div style={{ padding: "0.6rem", backgroundColor: "#000000", color: "#ffffff", borderRadius: "4px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {disable2FAError}
              </div>
            )}

            <form onSubmit={handleConfirmDisable2FA} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Account Password *</label>
                <input
                  type="password"
                  required
                  autoFocus
                  className="form-input"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowDisable2FAModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={disable2FASubmitting} className="btn btn-primary">
                  {disable2FASubmitting ? "Disabling..." : "Confirm & Disable 2FA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
