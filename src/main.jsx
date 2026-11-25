import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n/index.js";
import RaceIQApp from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RaceIQApp />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
