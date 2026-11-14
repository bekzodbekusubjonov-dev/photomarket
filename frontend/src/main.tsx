import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { FavoritesProvider } from "./favorites";
import { AppLockProvider } from "./applock";
import { registerSW } from "./pwa";
import { LangProvider } from "./i18n";
import { ToastProvider } from "./components/ui";
import { UnreadProvider } from "./components/unread";
import "./styles.css";

registerSW();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UnreadProvider>
          <ToastProvider>
            <LangProvider><AppLockProvider><FavoritesProvider><App /></FavoritesProvider></AppLockProvider></LangProvider>
          </ToastProvider>
        </UnreadProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
