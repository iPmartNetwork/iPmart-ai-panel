import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/base.css";
import "./styles/ipmart-theme.css";
import { initTheme } from "./lib/theme.js";
import { registerPWA } from "./lib/pwa.js";

initTheme();
registerPWA();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);