import { Outlet, useLocation } from "react-router";
import { Header } from "./components/Header";
import { ImportLockProvider } from "./features/import/ImportLockContext";
import {
  NavPendingProvider,
  useNavPending,
} from "./features/shell/NavPendingContext";
import "./App.css";

const LOADING_COPY: Record<string, { title: string; hint?: string }> = {
  "/": { title: "Transaktionen werden geladen…" },
  "/analyse": {
    title: "Auswertung wird geladen…",
  },
  "/upload": { title: "Upload wird geladen…" },
  "/einstellungen": { title: "Einstellungen werden geladen…" },
};

export function App() {
  return (
    <ImportLockProvider>
      <NavPendingProvider>
        <AppShell />
      </NavPendingProvider>
    </ImportLockProvider>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const { pendingTo } = useNavPending();
  const showRouteLoading = pendingTo != null;
  const copy =
    LOADING_COPY[pendingTo ?? ""] ?? { title: "Seite wird geladen…" };

  return (
    <div className="zm-app">
      <Header />
      <main className="zm-main">
        <div className="zm-surface">
          {showRouteLoading && (
            <div
              className="zm-route-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="zm-related-spinner" aria-hidden />
              <p>{copy.title}</p>
              {copy.hint && <p className="zm-page-lead">{copy.hint}</p>}
            </div>
          )}
          <div
            key={pathname}
            className={`zm-page-enter${showRouteLoading ? " is-route-loading" : ""}`}
            aria-hidden={showRouteLoading || undefined}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
