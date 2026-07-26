import { Link, useLocation, useNavigate } from "react-router";
import { flushSync } from "react-dom";
import { useImportLock } from "../features/import/ImportLockContext";
import { useNavPending } from "../features/shell/NavPendingContext";

const navItems = [
  { to: "/", label: "Transaktionen", icon: "/design/Tables.svg" },
  { to: "/analyse", label: "Analyse", icon: "/design/Analysis.svg" },
  { to: "/upload", label: "Upload", icon: "/design/Upload.svg" },
  { to: "/einstellungen", label: "Einstellungen", icon: "/design/Settings.svg" },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { importLocked } = useImportLock();
  const { pendingTo, beginPending, clearPending } = useNavPending();

  function go(to: (typeof navItems)[number]["to"]) {
    if (isActive(pathname, to)) {
      clearPending();
      return;
    }
    flushSync(() => {
      beginPending(to);
    });
    navigate(to);
  }

  return (
    <>
      <Link
        to="/"
        className={`zm-brand${importLocked ? " is-disabled" : ""}`}
        title="Zaster Master"
        aria-label="Zaster Master — zur Transaktionen"
        onClick={(e) => {
          e.preventDefault();
          if (importLocked) return;
          go("/");
        }}
        aria-disabled={importLocked || undefined}
      >
        <img
          src="/design/Zaster_Master_Logo.svg"
          alt=""
          className="zm-logo"
        />
      </Link>

      <nav className="zm-side-nav" aria-label="Hauptnavigation">
        {navItems.map(({ to, label, icon }) => {
          const active = isActive(pathname, to) || pendingTo === to;
          const locked = importLocked && to !== "/upload";
          return (
            <Link
              key={to}
              to={to}
              className={`zm-nav-link${active ? " is-active" : ""}${locked ? " is-disabled" : ""}`}
              title={locked ? "Import läuft…" : label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              aria-disabled={locked || undefined}
              onClick={(e) => {
                e.preventDefault();
                if (locked) return;
                go(to);
              }}
              tabIndex={locked ? -1 : undefined}
            >
              <img src={icon} alt="" className="zm-nav-icon" aria-hidden />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
