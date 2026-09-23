import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, requiredPermission, requiredRole }) => {
  const { user, loading, isAuthenticated, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        <p>Verifying chambers authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !user.isOwner && !user.roles?.includes(requiredRole)) {
    return (
      <div className="card" style={{ maxWidth: "600px", margin: "2rem auto" }}>
        <h2 className="card-title" style={{ color: "var(--color-danger)" }}>Access Restricted</h2>
        <p className="card-subtitle">
          Your assigned role (<strong>{user.roles?.join(", ") || "None"}</strong>) does not have access to this chambers section.
        </p>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="card" style={{ maxWidth: "600px", margin: "2rem auto" }}>
        <h2 className="card-title" style={{ color: "var(--color-danger)" }}>Access Restricted</h2>
        <p className="card-subtitle">
          This area requires the <strong>{requiredPermission}</strong> permission. Contact Senior Advocate / Chambers Administrator if you need access.
        </p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
