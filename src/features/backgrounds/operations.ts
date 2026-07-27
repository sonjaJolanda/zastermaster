import { copyFile, mkdir, readdir } from "node:fs/promises";
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

async function syncDesignBackgroundsToPublic(): Promise<void> {
  const designDir = await firstExistingDir(repoPathCandidates("Design"));
  const publicDesignDir =
    (await firstExistingDir(repoPathCandidates("public", "design"))) ??
    repoPathCandidates("public", "design")[0]!;

  if (!designDir) return;
  await mkdir(publicDesignDir, { recursive: true });

  const files = await readdir(designDir, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !isBackgroundImageFile(file.name)) continue;
    const from = join(designDir, file.name);
    const to = join(publicDesignDir, file.name);
    try {
      await copyFile(from, to);
    } catch {
      // ignore and continue with remaining files
    }
  }
}

export const getBackgroundOptions: GetBackgroundOptions<
  void,
  BackgroundOption[]
> = async () => {
  await syncDesignBackgroundsToPublic();

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
