import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div style={{ maxWidth: "520px", margin: "3rem auto", textAlign: "center" }}>
      <div className="card">
        <h1 className="card-title" style={{ fontSize: "2rem" }}>
          404 - Page Not Found
        </h1>
        <p className="card-subtitle">
          The requested resource or chambers page does not exist or has been moved.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <Link to="/" className="btn btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
