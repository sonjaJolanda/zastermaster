import { useEffect, useState } from "react";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  getAccounts,
  getCategories,
  seedCategoriesIfEmpty,
  setKeywords,
  updateCategory,
  updateSubcategory,
  useQuery,
} from "wasp/client/operations";
import { BalanceCalibrationModal } from "../components/BalanceCalibrationModal";
import type { CategoryTreeNode } from "../features/categories/types";

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
      <h1 className="zm-page-title">Einstellungen</h1>
      <p className="zm-page-lead">
        Kontostände kalibrieren sowie Kategorien und Stichwörter pflegen.
      </p>

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

      <div className="zm-accounts-panel">
        <h2 className="zm-cat-section-title">Konten &amp; Kontostand</h2>
        <p className="zm-page-lead">
          Anzeige im Header = kalibrierter Stand + Buchungen nach dem
          Stichtag (Roll-forward).
        </p>
        {(accounts?.length ?? 0) === 0 ? (
          <p className="zm-page-lead">Noch keine Konten — zuerst importieren.</p>
        ) : (
          <ul className="zm-account-list">
            {accounts!.map((a) => (
              <li key={a.id} className="zm-account-row">
                <div>
                  <strong>
                    {a.bank.toUpperCase()} · {a.konto}
                  </strong>
                  <div className="zm-cat-meta">
                    {a.asOfDate
                      ? `Kalibriert ${a.asOfDate}: ${eur.format(Number(a.currentBalance ?? 0))}`
                      : "Noch nicht kalibriert"}
                    {a.displayBalance != null && (
                      <> · Anzeige: {eur.format(Number(a.displayBalance))}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="zm-btn zm-btn-ghost"
                  onClick={() =>
                    setCalibrateAccount({
                      accountId: a.id,
                      bank: a.bank,
                      konto: a.konto,
                      suggestedBalance: a.currentBalance ?? a.displayBalance,
                    })
                  }
                >
                  {a.currentBalance == null ? "Kalibrieren" : "Anpassen"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(!seedReady || isLoading) && (
        <p className="zm-page-lead">Kategorien werden geladen…</p>
      )}

      {categories && (
        <div className="zm-cat-create">
          <h2 className="zm-cat-section-title">Neue Kategorie</h2>
          <div className="zm-cat-edit-row">
            <input
              className="zm-input"
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
        </div>
      )}

      {categories && categories.length === 0 && !isLoading && (
        <p className="zm-page-lead">Keine Kategorien vorhanden.</p>
      )}

      {categories && categories.length > 0 && (
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
        </ul>
      )}

      {calibrateAccount && (
        <BalanceCalibrationModal
          accountId={calibrateAccount.accountId}
          bank={calibrateAccount.bank}
          konto={calibrateAccount.konto}
          suggestedBalance={calibrateAccount.suggestedBalance}
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

type CardProps = {
  category: CategoryTreeNode;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onRun: (label: string, fn: () => Promise<unknown>) => Promise<void>;
};

function CategoryCard({
  category,
  expanded,
  busy,
  onToggle,
  onRun,
}: CardProps) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [mainKeywords, setMainKeywords] = useState(
    category.keywords.map((k) => k.keyword),
  );
  const [subName, setSubName] = useState("");
  const [subColor, setSubColor] = useState(category.color);

  useEffect(() => {
    setName(category.name);
    setColor(category.color);
    setMainKeywords(category.keywords.map((k) => k.keyword));
    setSubColor(category.color);
  }, [category]);

  return (
    <li className={`zm-cat-card${expanded ? " is-expanded" : ""}`}>
      <header className="zm-cat-card-header">
        <span
          className="zm-cat-swatch"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
        <h2 className="zm-cat-name">{category.name}</h2>
        <span className="zm-cat-meta">
          {category.subcategories.length} Unter · {category.keywords.length}{" "}
          Stichwörter
        </span>
        <button
          type="button"
          className="zm-btn zm-btn-ghost zm-cat-toggle"
          onClick={onToggle}
        >
          {expanded ? "Schließen" : "Bearbeiten"}
        </button>
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
          <h3 className="zm-cat-section-title">Hauptkategorie</h3>
          <div className="zm-cat-edit-row">
            <input
              className="zm-input"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Farbe"
            />
            <input
              className="zm-input zm-cat-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className="zm-btn zm-btn-primary"
              disabled={busy}
              onClick={() =>
                void onRun("Kategorie gespeichert.", () =>
                  updateCategory({ id: category.id, name, color }),
                )
              }
            >
              Speichern
            </button>
            <button
              type="button"
              className="zm-btn zm-btn-ghost"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    `Kategorie „${category.name}“ wirklich löschen?`,
                  )
                ) {
                  return;
                }
                void onRun("Kategorie gelöscht.", () =>
                  deleteCategory({ id: category.id }),
                );
              }}
            >
              Löschen
            </button>
          </div>

          <KeywordEditor
            label="Stichwörter (Hauptkategorie)"
            keywords={mainKeywords}
            busy={busy}
            onChange={setMainKeywords}
            onSave={() =>
              void onRun("Stichwörter gespeichert.", () =>
                setKeywords({
                  categoryId: category.id,
                  keywords: mainKeywords,
                }),
              )
            }
          />

          <h3 className="zm-cat-section-title">Unterkategorien</h3>
          <div className="zm-cat-edit-row">
            <input
              className="zm-input"
              type="color"
              value={subColor}
              onChange={(e) => setSubColor(e.target.value)}
              aria-label="Farbe neue Unterkategorie"
            />
            <input
              className="zm-input zm-cat-name-input"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Neue Unterkategorie"
              disabled={busy}
            />
            <button
              type="button"
              className="zm-btn zm-btn-primary"
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
              Unter anlegen
            </button>
          </div>

          <ul className="zm-subcat-edit-list">
            {category.subcategories.map((sub) => (
              <SubcategoryEditor
                key={sub.id}
                sub={sub}
                busy={busy}
                onRun={onRun}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function SubcategoryEditor({
  sub,
  busy,
  onRun,
}: {
  sub: CategoryTreeNode["subcategories"][number];
  busy: boolean;
  onRun: (label: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(sub.name);
  const [color, setColor] = useState(sub.color);
  const [keywords, setKw] = useState(sub.keywords.map((k) => k.keyword));

  useEffect(() => {
    setName(sub.name);
    setColor(sub.color);
    setKw(sub.keywords.map((k) => k.keyword));
  }, [sub]);

  return (
    <li className="zm-subcat-editor">
      <div className="zm-cat-edit-row">
        <input
          className="zm-input"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label={`Farbe ${sub.name}`}
        />
        <input
          className="zm-input zm-cat-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="zm-btn zm-btn-primary"
          disabled={busy}
          onClick={() =>
            void onRun("Unterkategorie gespeichert.", () =>
              updateSubcategory({
                id: sub.id,
                name,
                color,
              }),
            )
          }
        >
          Speichern
        </button>
        <button
          type="button"
          className="zm-btn zm-btn-ghost"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(`Unterkategorie „${sub.name}“ wirklich löschen?`)
            ) {
              return;
            }
            void onRun("Unterkategorie gelöscht.", () =>
              deleteSubcategory({ id: sub.id }),
            );
          }}
        >
          Löschen
        </button>
      </div>
      <KeywordEditor
        label="Stichwörter"
        keywords={keywords}
        busy={busy}
        onChange={setKw}
        onSave={() =>
          void onRun("Stichwörter gespeichert.", () =>
            setKeywords({ subcategoryId: sub.id, keywords }),
          )
        }
      />
    </li>
  );
}

function KeywordEditor({
  label,
  keywords,
  busy,
  onChange,
  onSave,
}: {
  label: string;
  keywords: string[];
  busy: boolean;
  onChange: (next: string[]) => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState("");

  function addKeyword() {
    const kw = draft.trim();
    if (!kw) return;
    if (keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...keywords, kw]);
    setDraft("");
  }

  return (
    <div className="zm-keyword-editor">
      <span className="zm-field-label">{label}</span>
      <div className="zm-chip-row">
        {keywords.map((kw) => (
          <button
            key={kw}
            type="button"
            className="zm-chip is-active"
            disabled={busy}
            title="Entfernen"
            onClick={() =>
              onChange(keywords.filter((k) => k !== kw))
            }
          >
            {kw} ×
          </button>
        ))}
        {keywords.length === 0 && (
          <span className="zm-page-lead">Keine Stichwörter</span>
        )}
      </div>
      <div className="zm-cat-edit-row">
        <input
          className="zm-input zm-cat-name-input"
          value={draft}
          disabled={busy}
          placeholder="Stichwort hinzufügen"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addKeyword();
            }
          }}
        />
        <button
          type="button"
          className="zm-btn zm-btn-ghost"
          disabled={busy || !draft.trim()}
          onClick={addKeyword}
        >
          Hinzufügen
        </button>
        <button
          type="button"
          className="zm-btn zm-btn-primary"
          disabled={busy}
          onClick={onSave}
        >
          Stichwörter speichern
        </button>
      </div>
    </div>
  );
}
