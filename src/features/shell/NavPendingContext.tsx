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
  beginPending: (to: string) => void;
  clearPending: () => void;
};

const NavPendingContext = createContext<NavPendingContextValue | null>(null);

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  const beginPending = useCallback((to: string) => {
    setPendingTo(to);
  }, []);

  const clearPending = useCallback(() => {
    setPendingTo(null);
  }, []);

  const value = useMemo(
    () => ({ pendingTo, beginPending, clearPending }),
    [pendingTo, beginPending, clearPending],
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
  const { pendingTo, clearPending } = useNavPending();

  useEffect(() => {
    if (!pendingTo) return;
    if (pathname !== pendingTo) return;
    if (!ready) return;
    const t = window.setTimeout(() => {
      clearPending();
    }, 180);
    return () => window.clearTimeout(t);
  }, [pendingTo, pathname, ready, clearPending]);
}
