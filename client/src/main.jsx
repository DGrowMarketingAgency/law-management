// Polyfill crypto.randomUUID for non-secure HTTP contexts (e.g. testing on LAN IP like 192.168.x.x)
if (typeof window !== "undefined") {
  if (!window.crypto) {
    window.crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (
          +c ^
          (window.crypto.getRandomValues
            ? window.crypto.getRandomValues(new Uint8Array(1))[0]
            : Math.floor(Math.random() * 256)) &
            (15 >> (+c / 4))
        ).toString(16)
      );
    };
  }
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
