import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

type NavPendingContextValue = {
  pendingTo: string | null;
  pendingStartedAt: number;
  beginPending: (to: string) => void;
  clearPending: () => void;
};

const NavPendingContext = createContext<NavPendingContextValue | null>(null);

/** Keep the overlay visible long enough to notice even on cache hits. */
const MIN_PENDING_MS = 350;

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const [pendingStartedAt, setPendingStartedAt] = useState(0);

  const beginPending = useCallback((to: string) => {
    setPendingStartedAt(Date.now());
    setPendingTo(to);
    window.scrollTo(0, 0);
  }, []);

  const clearPending = useCallback(() => {
    setPendingTo(null);
  }, []);

  const value = useMemo(
    () => ({ pendingTo, pendingStartedAt, beginPending, clearPending }),
    [pendingTo, pendingStartedAt, beginPending, clearPending],
  );

  return (
    <NavPendingContext.Provider value={value}>
      {children}
    </NavPendingContext.Provider>
  );
}

export function useNavPending() {
  const ctx = useContext(NavPendingContext);
  if (!ctx) {
    throw new Error("useNavPending must be used within NavPendingProvider");
  }
  return ctx;
}

/** Clear the route-loading overlay once this page has arrived and is ready. */
export function useClearNavPendingWhen(ready: boolean) {
  const { pathname } = useLocation();
  const { pendingTo, pendingStartedAt, clearPending } = useNavPending();

  useEffect(() => {
    if (!pendingTo) return;
    if (pathname !== pendingTo) return;
    if (!ready) return;
    const elapsed = Date.now() - (pendingStartedAt || Date.now());
    const wait = Math.max(MIN_PENDING_MS - elapsed, 0);
    const t = window.setTimeout(() => {
      clearPending();
    }, wait);
    return () => window.clearTimeout(t);
  }, [pendingTo, pathname, ready, clearPending, pendingStartedAt]);
}
