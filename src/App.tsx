import { Outlet, useLocation } from "react-router";
import { Header } from "./components/Header";
import { ImportLockProvider } from "./features/import/ImportLockContext";
import "./App.css";

export function App() {
  const { pathname } = useLocation();

  return (
    <ImportLockProvider>
      <div className="zm-app">
        <Header />
        <main className="zm-main">
          <div className="zm-surface">
            <div key={pathname} className="zm-page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </ImportLockProvider>
  );
}
