# Multi-stage ship image for Zaster Master (Wasp 0.24).
# Targets: server-production | client-production
#
# Builds Wasp inside Docker so end users only need Docker Desktop.
# Wasp 0.24 `wasp build` output lives in `.wasp/out/` (not `.wasp/build/`).

ARG NODE_IMAGE=node:24.14.1-bookworm
ARG NODE_ALPINE=node:24.14.1-alpine3.23
ARG WASP_VERSION=0.24.0

# ─── 1) wasp build ───────────────────────────────────────────────
FROM ${NODE_IMAGE} AS wasp-builder
ARG WASP_VERSION
ENV WASP_TELEMETRY_DISABLED=1
RUN npm install -g "@wasp.sh/wasp-cli@${WASP_VERSION}"
WORKDIR /app
COPY . .
RUN wasp version \
  && wasp install \
  && wasp build \
  && if [ ! -d .wasp/out/src ] && [ -d .wasp/out/user/src ]; then \
       cp -a .wasp/out/user/src .wasp/out/src; \
     fi \
  && test -d .wasp/out/server \
  && test -f .wasp/out/package.json \
  && ls -la .wasp/out

# ─── 2) server npm bundle (mirrors Wasp-generated Dockerfile) ───
FROM ${NODE_ALPINE} AS node
RUN apk --no-cache -U upgrade \
  && apk add --no-cache openssl

FROM node AS server-builder
RUN apk add --no-cache python3 build-base libtool autoconf automake
WORKDIR /app
COPY --from=wasp-builder /app/.wasp/out/src ./src
COPY --from=wasp-builder /app/.wasp/out/package.json .
COPY --from=wasp-builder /app/.wasp/out/package-lock.json .
# Wasp 0.24 emits tsconfig.src.json at out root (referenced from server/tsconfig.json).
COPY --from=wasp-builder /app/.wasp/out/tsconfig.src.json ./
COPY --from=wasp-builder /app/.wasp/out/server .wasp/out/server
COPY --from=wasp-builder /app/.wasp/out/sdk .wasp/out/sdk
COPY --from=wasp-builder /app/.wasp/out/libs .wasp/out/libs
RUN npm install && cd .wasp/out/server && npm install
COPY --from=wasp-builder /app/.wasp/out/db/schema.prisma .wasp/out/db/
RUN cd .wasp/out/server && npx prisma generate --schema='../db/schema.prisma'
RUN cd .wasp/out/server && npm run bundle
RUN mkdir -p ./.wasp/out/server/node_modules

# ─── 3) server runtime ──────────────────────────────────────────
FROM node AS server-production
RUN apk add --no-cache python3
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/.wasp/out/server/node_modules .wasp/out/server/node_modules
COPY --from=server-builder /app/.wasp/out/server/bundle .wasp/out/server/bundle
COPY --from=server-builder /app/.wasp/out/server/package*.json .wasp/out/server/
COPY --from=wasp-builder /app/.wasp/out/db/ .wasp/out/db/
COPY --from=wasp-builder /app/categories_seed.json ./categories_seed.json
# Background picker reads rasters from public/design (relative to /app)
COPY --from=wasp-builder /app/public ./public
EXPOSE 3001
WORKDIR /app/.wasp/out/server
ENTRYPOINT ["npm", "run", "start-production"]

# ─── 4) client static build (Wasp 0.24: vite from project root) ─
FROM wasp-builder AS client-builder
ARG REACT_APP_API_URL=http://zastermaster:3002
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
WORKDIR /app
# node_modules already present from wasp install/build in wasp-builder
RUN REACT_APP_API_URL=${REACT_APP_API_URL} npx vite build \
  && test -f .wasp/out/web-app/build/200.html \
  && cp .wasp/out/web-app/build/200.html .wasp/out/web-app/build/index.html

# ─── 5) client runtime (SPA) ────────────────────────────────────
FROM pierrezemb/gostatic AS client-production
COPY --from=client-builder /app/.wasp/out/web-app/build /srv/http
CMD ["-fallback", "index.html", "-enable-logging", "-port", "80"]
