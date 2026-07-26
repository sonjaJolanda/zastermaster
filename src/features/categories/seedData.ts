import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SeedSubcategory = {
  color: string;
  keywords: string[];
};

export type SeedCategory = {
  color: string;
  keywords: string[];
  subcategories: Record<string, SeedSubcategory>;
};

export type SeedFile = Record<string, SeedCategory>;

/**
 * Resolve `categories_seed.json` from the repo root whether the server
 * cwd is the project root or `.wasp/out/server`.
 */
export function loadCategoriesSeed(): SeedFile {
  const candidates = [
    join(process.cwd(), "categories_seed.json"),
    join(process.cwd(), "../../categories_seed.json"),
    join(process.cwd(), "../../../categories_seed.json"),
  ];

  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as SeedFile;
    } catch {
      // try next
    }
  }

  throw new Error(
    "categories_seed.json not found (looked relative to process.cwd())",
  );
}
