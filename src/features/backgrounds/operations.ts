import { readdir } from "node:fs/promises";
import { extname, join, basename } from "node:path";
import type { GetBackgroundOptions } from "wasp/server/operations";

export type BackgroundOption = {
  id: string;
  name: string;
  url: string;
};

const RASTER_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function repoPathCandidates(...parts: string[]): string[] {
  return [
    join(process.cwd(), ...parts),
    join(process.cwd(), "..", "..", ...parts),
    join(process.cwd(), "..", "..", "..", ...parts),
  ];
}

async function firstExistingDir(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      if (entries) return path;
    } catch {
      // try next
    }
  }
  return null;
}

function isBackgroundImageFile(fileName: string): boolean {
  return RASTER_EXTS.has(extname(fileName).toLowerCase());
}

function labelFromFileName(fileName: string): string {
  const stem = basename(fileName, extname(fileName))
    .replace(/^BackgroundImage[_ -]*/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return stem || fileName;
}

/** List background rasters from `public/design/` (source of truth for assets). */
export const getBackgroundOptions: GetBackgroundOptions<
  void,
  BackgroundOption[]
> = async () => {
  const publicDesignDir = await firstExistingDir(
    repoPathCandidates("public", "design"),
  );
  if (!publicDesignDir) return [];

  const files = await readdir(publicDesignDir, { withFileTypes: true });
  return files
    .filter((file) => file.isFile() && isBackgroundImageFile(file.name))
    .map((file) => ({
      id: file.name,
      name: labelFromFileName(file.name),
      url: `/design/${encodeURIComponent(file.name)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
};
