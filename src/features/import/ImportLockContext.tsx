import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ImportLockContextValue = {
  importLocked: boolean;
  setImportLocked: (locked: boolean) => void;
};

const ImportLockContext = createContext<ImportLockContextValue | null>(null);

export function ImportLockProvider({ children }: { children: ReactNode }) {
  const [importLocked, setImportLocked] = useState(false);
  const value = useMemo(
    () => ({ importLocked, setImportLocked }),
    [importLocked],
  );
  return (
    <ImportLockContext.Provider value={value}>
      {children}
    </ImportLockContext.Provider>
  );
}

export function useImportLock() {
  const ctx = useContext(ImportLockContext);
  if (!ctx) {
    return {
      importLocked: false,
      setImportLocked: (_locked: boolean) => undefined,
    };
  }
  return ctx;
}
