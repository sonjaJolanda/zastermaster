import { Outlet } from "react-router";
import { Header } from "./components/Header";
import "./App.css";

export function App() {
  return (
    <div className="zm-app">
      <Header />
      <main className="zm-main">
        <div className="zm-surface">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
