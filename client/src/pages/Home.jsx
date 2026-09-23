import React from "react";
import HealthStatus from "../components/HealthStatus";

const Home = () => {
  return (
    <div>
      <div className="card">
        <h1 className="card-title" style={{ fontSize: "1.6rem" }}>
          Legal Practice Management
        </h1>
        <p className="card-subtitle" style={{ fontSize: "1rem" }}>
          Private Chambers Management Platform
        </p>
        <div className="notice-banner">
          <strong>Internal Chambers System:</strong> This portal provides an internal workspace
          for advocates and junior associates. Public client marketing, lawyer listings, and lead
          marketplaces are out of scope.
        </div>
      </div>

      <HealthStatus />
    </div>
  );
};

export default Home;
