import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useLocation } from "react-router";
import { Header } from "./components/Header";
import {
  BACKGROUND_PREFS_EVENT,
  loadBackgroundPrefs,
  tabKeyForPath,
} from "./features/backgrounds/persist";
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
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(() => {
    const prefs = loadBackgroundPrefs("/design/BackgroundImage_Office%20-%20Kopie.JPEG");
    return prefs[tabKeyForPath(pathname)];
  });

  useEffect(() => {
    const refresh = () => {
      const prefs = loadBackgroundPrefs(
        "/design/BackgroundImage_Office%20-%20Kopie.JPEG",
      );
      setBackgroundUrl(prefs[tabKeyForPath(pathname)]);
    };
    refresh();
    window.addEventListener(BACKGROUND_PREFS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(BACKGROUND_PREFS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  return (
    <div
      className="zm-app"
      style={
        backgroundUrl
          ? ({ "--zm-bg-image": `url("${backgroundUrl}")` } as CSSProperties)
          : undefined
      }
    >
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
