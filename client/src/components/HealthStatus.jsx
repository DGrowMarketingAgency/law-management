import React, { useState, useEffect } from "react";
import { checkHealth } from "../services/api";

const HealthStatus = () => {
  const [status, setStatus] = useState({
    loading: true,
    backend: "Checking...",
    database: "Checking...",
  });

  const fetchHealth = async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const response = await checkHealth();
      if (response && response.success) {
        setStatus({
          loading: false,
          backend: response.data.status === "ok" ? "Connected" : "Degraded",
          database:
            response.data.database === "connected"
              ? "Connected"
              : "Disconnected",
        });
      } else {
        setStatus({
          loading: false,
          backend: "Disconnected",
          database: "Disconnected",
        });
      }
    } catch {
      setStatus({
        loading: false,
        backend: "Disconnected",
        database: "Disconnected",
      });
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const getBadgeClass = (state) => {
    if (state === "Connected") return "connected";
    if (state === "Disconnected") return "disconnected";
    return "checking";
  };

  return (
    <div className="card">
      <h2 className="card-title">System Connectivity & Health</h2>
      <p className="card-subtitle">
        Live communication verification between React frontend, Express API, and MySQL database.
      </p>

      <div className="status-badge-container">
        <div className={`status-badge ${getBadgeClass(status.backend)}`}>
          <span className="status-dot"></span>
          <span>Backend: {status.backend}</span>
        </div>

        <div className={`status-badge ${getBadgeClass(status.database)}`}>
          <span className="status-dot"></span>
          <span>Database: {status.database}</span>
        </div>

        <button
          onClick={fetchHealth}
          className="btn btn-secondary"
          style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
          disabled={status.loading}
        >
          {status.loading ? "Checking..." : "Recheck Status"}
        </button>
      </div>
    </div>
  );
};

export default HealthStatus;
