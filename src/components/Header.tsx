import { Link, useLocation } from "react-router";
import {
  ArrowUpFromLine,
  BarChart3,
  List,
  Settings,
} from "lucide-react";
import { getHeaderBalance, useQuery } from "wasp/client/operations";

const navItems = [
  { to: "/upload", label: "Upload", Icon: ArrowUpFromLine },
  { to: "/einstellungen", label: "Einstellungen", Icon: Settings },
  { to: "/", label: "Transaktionen", Icon: List },
  { to: "/analyse", label: "Analyse", Icon: BarChart3 },
] as const;

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Header() {
  const { pathname } = useLocation();
  const { data: balance } = useQuery(getHeaderBalance);

  const balanceLabel =
    balance?.total != null ? eur.format(Number(balance.total)) : "—";

  const title =
    balance && balance.calibratedCount > 0
      ? `Kalibrierter Kontostand (Summe von ${balance.calibratedCount} Konto/Konten)`
      : "Kalibrierter Kontostand (Summe) — nach Import kalibrieren";

  return (
    <header className="zm-header">
      <Link to="/" className="zm-brand" title="Zaster Master">
        <img
          src="/design/Zaster_Master_Logo.svg"
          alt="Zaster Master"
          className="zm-logo"
        />
        <span className="zm-brand-text">Zaster Master</span>
      </Link>

      <p className="zm-balance" title={title}>
        Kontostand: <span className="zm-balance-value">{balanceLabel}</span>
      </p>

      <nav className="zm-nav" aria-label="Hauptnavigation">
        {navItems.map(({ to, label, Icon }) => {
          const active = isActive(pathname, to);
          return (
            <Link
              key={to}
              to={to}
              className={`zm-nav-link${active ? " is-active" : ""}`}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden />
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
