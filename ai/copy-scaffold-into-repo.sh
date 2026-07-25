#!/usr/bin/env bash
set -euo pipefail
PROJ="/mnt/c/Users/sonja/IdeaProjects/zastermaster"
SRC="/root/projects/zastermaster-scaffold"

if [ ! -d "$SRC" ]; then
  echo "MISSING scaffold at $SRC"
  exit 1
fi

cd "$PROJ"

# Core wasp files
for f in main.wasp.ts schema.prisma package.json package-lock.json \
         tsconfig.json tsconfig.src.json tsconfig.wasp.json vite.config.ts \
         .npmrc .waspignore .wasproot AGENTS.md CLAUDE.md; do
  cp -a "$SRC/$f" "$PROJ/"
done

rm -rf "$PROJ/src" "$PROJ/public"
cp -a "$SRC/src" "$SRC/public" "$PROJ/"

# Customize identity + postgres
cat > "$PROJ/main.wasp.ts" <<'EOF'
import { app, page, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };

export default app({
  name: "ZasterMaster",
  title: "Zaster Master",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  spec: [
    route("RootRoute", "/", page(MainPage)),
  ],
});
EOF

cat > "$PROJ/schema.prisma" <<'EOF'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
EOF

# Env example + local env (dev placeholders)
cat > "$PROJ/.env.server.example" <<'EOF'
DATABASE_URL="postgresql://zaster:zaster@localhost:5432/zastermaster"
EOF

cat > "$PROJ/.env.server" <<'EOF'
DATABASE_URL="postgresql://zaster:zaster@localhost:5432/zastermaster"
EOF

# Merge gitignore
if ! grep -q "^\.wasp/" "$PROJ/.gitignore" 2>/dev/null; then
  printf '\n# Wasp\n.wasp/\nnode_modules/\n.env\n.env.*\n!.env.example\n!.env.*.example\n' >> "$PROJ/.gitignore"
fi

# Seed file is categories_seed.json (already in repo)

# package.json name
python3 - <<'PY' || true
import json
from pathlib import Path
p = Path("/mnt/c/Users/sonja/IdeaProjects/zastermaster/package.json")
data = json.loads(p.read_text())
data["name"] = "zastermaster"
p.write_text(json.dumps(data, indent=2) + "\n")
PY

echo "=== Project root ==="
ls -la "$PROJ" | head -50
echo "=== src ==="
find "$PROJ/src" -type f
echo "DONE"
