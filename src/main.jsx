import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n/index.js";
import RaceIQApp from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RaceIQApp />
    </AuthProvider>
  </React.StrictMode>
);
