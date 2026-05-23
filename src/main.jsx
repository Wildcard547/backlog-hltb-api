import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Polyfill window.storage (Claude Artifact API) with localStorage
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value != null ? { value } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

createRoot(document.getElementById("root")).render(<App />);
