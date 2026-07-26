import { useEffect, useState } from "react";
import {
  getCategories,
  seedCategoriesIfEmpty,
  useQuery,
} from "wasp/client/operations";
import type { CategoryTreeNode } from "../features/categories/types";

export function EinstellungenPage() {
  const [seedReady, setSeedReady] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await seedCategoriesIfEmpty();
        if (!cancelled) setSeedReady(true);
      } catch (err) {
        if (!cancelled) {
          setSeedError(
            err instanceof Error ? err.message : "Seed fehlgeschlagen",
          );
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
    error,
  } = useQuery(getCategories, undefined, { enabled: seedReady });

  return (
    <section>
      <h1 className="zm-page-title">Einstellungen</h1>
      <p className="zm-page-lead">
        Kategorien (nur Anzeige). Bearbeiten folgt später.
      </p>

      {seedError && (
        <p className="zm-status-error" role="alert">
          Seed: {seedError}
        </p>
      )}
      {error && (
        <p className="zm-status-error" role="alert">
          Fehler: {String(error)}
        </p>
      )}
      {(!seedReady || isLoading) && (
        <p className="zm-page-lead">Kategorien werden geladen…</p>
      )}

      {categories && categories.length === 0 && !isLoading && (
        <p className="zm-page-lead">Keine Kategorien vorhanden.</p>
      )}

      {categories && categories.length > 0 && (
        <ul className="zm-cat-grid">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryCard({ category }: { category: CategoryTreeNode }) {
  return (
    <li className="zm-cat-card">
      <header className="zm-cat-card-header">
        <span
          className="zm-cat-swatch"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
        <h2 className="zm-cat-name">{category.name}</h2>
        {category.keywords.length > 0 && (
          <span className="zm-cat-meta">
            {category.keywords.length} Stichwörter
          </span>
        )}
      </header>

      {category.subcategories.length === 0 ? (
        <p className="zm-cat-empty">Keine Unterkategorien</p>
      ) : (
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
    </li>
  );
}
