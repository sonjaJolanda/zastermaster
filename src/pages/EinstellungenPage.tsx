import { useEffect, useState, type CSSProperties } from "react";
import {
  createCategory,
  createSubcategory,
  getAccounts,
  getCategories,
  getInvestmentKeywords,
  seedCategoriesIfEmpty,
  setInvestmentKeywords,
  setKeywords,
  updateCategory,
  updateSubcategory,
  useQuery,
} from "wasp/client/operations";
import { BalanceCalibrationModal } from "../components/BalanceCalibrationModal";
import { CloseIconButton, EditIconButton, PageTitle } from "../components/PageChrome";
import type { CategoryTreeNode } from "../features/categories/types";
import { useClearNavPendingWhen } from "../features/shell/NavPendingContext";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function EinstellungenPage() {
  const [seedReady, setSeedReady] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#78716c");
  const [calibrateAccount, setCalibrateAccount] = useState<{
    accountId: number;
    bank: string;
    konto: string;
    suggestedBalance: string | null;
    color: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await seedCategoriesIfEmpty();
        if (!cancelled) setSeedReady(true);
      } catch (err) {
        if (!cancelled) {
          setSeedError(errMsg(err));
          setSeedReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: categories,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery(getCategories, undefined, { enabled: seedReady });
  const {
    data: accounts,
    refetch: refetchAccounts,
  } = useQuery(getAccounts);

  useClearNavPendingWhen(seedReady && !isLoading);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await fn();
      setStatus(label);
      await refetch();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCategory() {
    if (!newName.trim()) {
      setError("Name für neue Kategorie fehlt.");
      return;
    }
    await run("Kategorie angelegt.", async () => {
      const created = await createCategory({
        name: newName,
        color: newColor,
      });
      setNewName("");
      setExpandedId(created.id);
    });
  }

  return (
    <section>
      <PageTitle icon="/design/Settings.svg">Einstellungen</PageTitle>

      {seedError && (
        <p className="zm-status-error" role="alert">
          Seed: {seedError}
        </p>
      )}
      {(error || queryError) && (
        <p className="zm-status-error" role="alert">
          {error ?? String(queryError)}
        </p>
      )}
      {status && (
        <p className="zm-page-lead" role="status">
          {status}
        </p>
      )}

      <div className="zm-settings-columns">
        <div className="zm-settings-col">
          <div className="zm-accounts-panel">
            <h2 className="zm-cat-section-title">Konten &amp; Kontostand</h2>
            {(accounts?.length ?? 0) === 0 ? (
              <p className="zm-page-lead">
                Noch keine Konten — zuerst importieren.
              </p>
            ) : (
              <ul className="zm-account-list">
                {accounts!.map((a) => (
                  <li key={a.id} className="zm-account-row">
                    <div className="zm-account-row-main">
                      <span
                        className="zm-cat-swatch"
                        style={{ backgroundColor: a.color }}
                        aria-hidden
                      />
                      <div>
                        <strong>
                          {a.bank.toUpperCase()} · {a.konto}
                        </strong>
                        <div className="zm-cat-meta">
                          {a.asOfDate
                            ? `Kalibriert ${a.asOfDate}: ${eur.format(Number(a.currentBalance ?? 0))}`
                            : "Noch nicht kalibriert"}
                          {a.displayBalance != null && (
                            <>
                              {" "}
                              · Anzeige: {eur.format(Number(a.displayBalance))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <EditIconButton
                      label={
                        a.currentBalance == null ? "Kalibrieren" : "Anpassen"
                      }
                      onClick={() =>
                        setCalibrateAccount({
                          accountId: a.id,
                          bank: a.bank,
                          konto: a.konto,
                          suggestedBalance:
                            a.currentBalance ?? a.displayBalance,
                          color: a.color,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <InvestmentKeywordsPanel
            busy={busy}
            onRun={run}
          />
        </div>

        <div className="zm-settings-col">
          <h2 className="zm-cat-section-title">Kategorien</h2>
          {(!seedReady || isLoading) && (
            <p className="zm-page-lead">Kategorien werden geladen…</p>
          )}
          {categories && categories.length === 0 && !isLoading && (
            <p className="zm-page-lead">Keine Kategorien vorhanden.</p>
          )}
          {categories && (
            <ul className="zm-cat-grid">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  expanded={expandedId === category.id}
                  busy={busy}
                  onToggle={() =>
                    setExpandedId((id) =>
                      id === category.id ? null : category.id,
                    )
                  }
                  onRun={run}
                />
              ))}
              <li className="zm-cat-card zm-cat-card--create">
                <h3 className="zm-cat-section-title">Neue Kategorie</h3>
                <div className="zm-cat-edit-row">
                  <input
                    className="zm-input zm-input-color"
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    title="Farbe"
                    aria-label="Farbe"
                  />
                  <input
                    className="zm-input zm-cat-name-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="zm-btn zm-btn-primary"
                    disabled={busy}
                    onClick={() => void handleCreateCategory()}
                  >
                    Anlegen
                  </button>
                </div>
              </li>
            </ul>
          )}
        </div>
      </div>

      {calibrateAccount && (
        <BalanceCalibrationModal
          accountId={calibrateAccount.accountId}
          bank={calibrateAccount.bank}
          konto={calibrateAccount.konto}
          suggestedBalance={calibrateAccount.suggestedBalance}
          color={calibrateAccount.color}
          onDone={() => {
            setCalibrateAccount(null);
            void refetchAccounts();
            setStatus("Kontostand gespeichert.");
          }}
          onSkip={() => setCalibrateAccount(null)}
        />
      )}
    </section>
  );
}

function InvestmentKeywordsPanel({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (label: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const { data: keywords, refetch } = useQuery(getInvestmentKeywords);
  const [draft, setDraft] = useState("");

  async function addKeyword() {
    const next = draft.trim();
    if (!next) return;
    const list = [...(keywords ?? [])];
    if (list.some((k) => k.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      return;
    }
    await onRun("Investitions-Stichwort gespeichert.", async () => {
      await setInvestmentKeywords({ keywords: [...list, next] });
      await refetch();
    });
    setDraft("");
  }

  async function removeKeyword(keyword: string) {
    const list = (keywords ?? []).filter((k) => k !== keyword);
    await onRun("Stichwort entfernt.", async () => {
      await setInvestmentKeywords({ keywords: list });
      await refetch();
    });
  }

  return (
    <div className="zm-accounts-panel" style={{ marginTop: "1.25rem" }}>
      <h2 className="zm-cat-section-title">Investitionen</h2>
      <p className="zm-page-lead">
        Stichwörter für „Investitionen erkennen“ (z. B. BUY, MSCI, Savings
        plan). Treffer werden erst nach Bestätigung zu <strong>Investiert</strong>.
      </p>
      <div className="zm-chip-row" style={{ marginBottom: "0.75rem" }}>
        {(keywords ?? []).length === 0 && (
          <span className="zm-cat-meta">Noch keine Stichwörter</span>
        )}
        {(keywords ?? []).map((kw) => (
          <button
            key={kw}
            type="button"
            className="zm-chip is-active"
            disabled={busy}
            title="Entfernen"
            onClick={() => void removeKeyword(kw)}
          >
            {kw} ×
          </button>
        ))}
      </div>
      <div className="zm-cat-edit-row">
        <input
          className="zm-input"
          value={draft}
          placeholder="Neues Stichwort…"
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addKeyword();
            }
          }}
        />
        <button
          type="button"
          className="zm-btn zm-btn-primary"
          disabled={busy || !draft.trim()}
          onClick={() => void addKeyword()}
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

type CardProps = {
  category: CategoryTreeNode;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onRun: (label: string, fn: () => Promise<unknown>) => Promise<void>;
};

type EditTarget = "main" | number | null;

function CategoryCard({
  category,
  expanded,
  busy,
  onToggle,
  onRun,
}: CardProps) {
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [subName, setSubName] = useState("");
  const [subColor, setSubColor] = useState(category.color);

  useEffect(() => {
    if (!expanded) setEditTarget(null);
  }, [expanded]);

  useEffect(() => {
    setSubColor(category.color);
  }, [category.color]);

  return (
    <li
      className={`zm-cat-card${expanded ? " is-expanded" : ""}`}
      style={
        {
          "--zm-cat-tint": category.color,
        } as CSSProperties
      }
    >
      <header className="zm-cat-card-header">
        <span
          className="zm-cat-swatch"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
        <div className="zm-cat-card-heading">
          <h2 className="zm-cat-name">{category.name}</h2>
          {category.keywords.length > 0 && (
            <span className="zm-cat-meta">
              {category.keywords.length} Stichwörter
            </span>
          )}
        </div>
        {expanded ? (
          <CloseIconButton
            className="zm-cat-toggle"
            label="Schließen"
            onClick={onToggle}
          />
        ) : (
          <EditIconButton
            className="zm-cat-toggle"
            label="Bearbeiten"
            onClick={onToggle}
          />
        )}
      </header>

      {!expanded && category.subcategories.length > 0 && (
        <ul className="zm-subcat-list">
          {category.subcategories.map((sub) => (
            <li key={sub.id} className="zm-subcat-item">
              <span
                className="zm-cat-swatch zm-cat-swatch--sm"
                style={{ backgroundColor: sub.color }}
                aria-hidden
              />
              <span className="zm-subcat-name">{sub.name}</span>
              {sub.keywords.length > 0 && (
                <span className="zm-cat-meta">
                  {sub.keywords.length} Stichwörter
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <div className="zm-cat-editor">
          <CategoryNodePanel
            name={category.name}
            color={category.color}
            keywords={category.keywords.map((k) => k.keyword)}
            busy={busy}
            editing={editTarget === "main"}
            onToggleEdit={() =>
              setEditTarget((t) => (t === "main" ? null : "main"))
            }
            onSaveNameColor={(name, color) =>
              onRun("Kategorie gespeichert.", () =>
                updateCategory({ id: category.id, name, color }),
              )
            }
            onSaveKeywords={(keywords) =>
              onRun("Stichwörter gespeichert.", () =>
                setKeywords({ categoryId: category.id, keywords }),
              )
            }
          />

          <div className="zm-cat-sub-grid">
            {category.subcategories.map((sub) => (
              <CategoryNodePanel
                key={sub.id}
                name={sub.name}
                color={sub.color}
                keywords={sub.keywords.map((k) => k.keyword)}
                busy={busy}
                editing={editTarget === sub.id}
                onToggleEdit={() =>
                  setEditTarget((t) => (t === sub.id ? null : sub.id))
                }
                onSaveNameColor={(name, color) =>
                  onRun("Unterkategorie gespeichert.", () =>
                    updateSubcategory({ id: sub.id, name, color }),
                  )
                }
                onSaveKeywords={(keywords) =>
                  onRun("Stichwörter gespeichert.", () =>
                    setKeywords({ subcategoryId: sub.id, keywords }),
                  )
                }
              />
            ))}
          </div>

          <div className="zm-cat-add-sub">
            <input
              className="zm-input zm-input-color"
              type="color"
              value={subColor}
              disabled={busy}
              aria-label="Farbe neue Unterkategorie"
              title="Farbe"
              onChange={(e) => setSubColor(e.target.value)}
            />
            <input
              className="zm-input zm-input-sm"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Neue Unterkategorie…"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && subName.trim()) {
                  e.preventDefault();
                  void onRun("Unterkategorie angelegt.", async () => {
                    await createSubcategory({
                      categoryId: category.id,
                      name: subName,
                      color: subColor,
                    });
                    setSubName("");
                  });
                }
              }}
            />
            <button
              type="button"
              className="zm-btn zm-btn-ghost"
              disabled={busy || !subName.trim()}
              onClick={() =>
                void onRun("Unterkategorie angelegt.", async () => {
                  await createSubcategory({
                    categoryId: category.id,
                    name: subName,
                    color: subColor,
                  });
                  setSubName("");
                })
              }
            >
              Anlegen
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CategoryNodePanel({
  name,
  color,
  keywords,
  busy,
  editing,
  onToggleEdit,
  onSaveNameColor,
  onSaveKeywords,
}: {
  name: string;
  color: string;
  keywords: string[];
  busy: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onSaveNameColor: (name: string, color: string) => Promise<void>;
  onSaveKeywords: (keywords: string[]) => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState(color);
  const [kwDraft, setKwDraft] = useState("");

  useEffect(() => {
    if (editing) {
      setDraftName(name);
      setDraftColor(color);
      setKwDraft("");
    }
  }, [editing, name, color]);

  async function saveNameColor() {
    const next = draftName.trim();
    if (!next) {
      setDraftName(name);
      return;
    }
    if (next === name && draftColor === color) return;
    await onSaveNameColor(next, draftColor);
  }

  async function addKeyword() {
    const kw = kwDraft.trim();
    if (!kw) return;
    if (keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setKwDraft("");
      return;
    }
    setKwDraft("");
    await onSaveKeywords([...keywords, kw]);
  }

  return (
    <div className={`zm-cat-node${editing ? " is-editing" : ""}`}>
      <div className="zm-cat-node-head">
        {editing ? (
          <>
            <input
              className="zm-input zm-input-color"
              type="color"
              value={draftColor}
              disabled={busy}
              aria-label={`Farbe ${name}`}
              title="Farbe"
              onChange={(e) => {
                const nextColor = e.target.value;
                setDraftColor(nextColor);
                void onSaveNameColor(draftName.trim() || name, nextColor);
              }}
            />
            <input
              className="zm-input zm-input-sm zm-cat-node-name-input"
              value={draftName}
              disabled={busy}
              aria-label="Name"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveNameColor();
                }
                if (e.key === "Escape") {
                  setDraftName(name);
                  setDraftColor(color);
                  onToggleEdit();
                }
              }}
            />
          </>
        ) : (
          <>
            <span
              className="zm-cat-swatch"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <strong className="zm-cat-node-name">{name}</strong>
          </>
        )}
        <EditIconButton
          className="zm-cat-node-edit"
          label={editing ? "Fertig" : "Bearbeiten"}
          disabled={busy}
          onClick={() => {
            if (editing) void saveNameColor().then(() => onToggleEdit());
            else onToggleEdit();
          }}
        />
      </div>

      {editing ? (
        <div className="zm-kw-line">
          <div className="zm-kw-list">
            {keywords.length === 0 ? (
              <span className="zm-cat-meta">Keine Stichwörter</span>
            ) : (
              keywords.map((kw, i) => (
                <span key={kw}>
                  {i > 0 && <span className="zm-kw-sep">, </span>}
                  <button
                    type="button"
                    className="zm-kw-item"
                    disabled={busy}
                    title="Entfernen"
                    onClick={() =>
                      void onSaveKeywords(keywords.filter((k) => k !== kw))
                    }
                  >
                    {kw}
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="zm-kw-add">
            <input
              className="zm-input zm-input-sm"
              value={kwDraft}
              disabled={busy}
              placeholder="Stichwort…"
              onChange={(e) => setKwDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addKeyword();
                }
              }}
            />
            <EditIconButton
              label="Stichwort hinzufügen"
              disabled={busy || !kwDraft.trim()}
              onClick={() => void addKeyword()}
            />
          </div>
        </div>
      ) : (
        <p className="zm-cat-node-keywords">
          {keywords.length > 0
            ? keywords.join(", ")
            : "Keine Stichwörter"}
        </p>
      )}
    </div>
  );
}
