# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - build the israeli-bank-scrapers fork into an installable tarball.
#
# The backend depends on a fork that is not published to npm, and it cannot be
# installed straight from git either: package.json points main at lib/, lib/ is
# gitignored, and the package has no prepare script, so a git install yields a
# package containing no code. Building it here and packing it means npm still
# resolves the scraper's own transitive dependencies normally.
# ---------------------------------------------------------------------------
FROM node:22-bookworm AS scraper-build

ARG SCRAPER_REPO=https://github.com/geriamir/israeli-bank-scrapers.git
# Pinned to a commit so an image rebuild is reproducible; a branch name would let
# the dependency change underneath an otherwise identical build. Bump deliberately
# after verifying the new scraper commit: git rev-parse origin/feature/add-foreign-currency
ARG SCRAPER_REF=5351a5020745d411d701f1dba66e0092fcccfc80

WORKDIR /scraper

# Chrome is not needed to compile the package.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# --depth 1 cannot take a raw SHA, so fetch just that commit into an empty repo.
RUN git init -q . \
    && git remote add origin "${SCRAPER_REPO}" \
    && git fetch -q --depth 1 origin "${SCRAPER_REF}" \
    && git checkout -q FETCH_HEAD \
    && npm ci --ignore-scripts --no-audit --no-fund \
    && npm run build:types \
    && npm run build:js \
    && mkdir -p /dist \
    && npm pack --pack-destination /dist \
    && mv /dist/*.tgz /dist/israeli-bank-scrapers.tgz

# ---------------------------------------------------------------------------
# Stage 2 - backend production dependencies.
# ---------------------------------------------------------------------------
FROM node:22-bookworm AS backend-deps

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=scraper-build /dist/israeli-bank-scrapers.tgz /tmp/israeli-bank-scrapers.tgz
COPY backend/package.json backend/package-lock.json ./
COPY backend/docker/prepare-deps.js ./docker/

# Install everything else straight from the lockfile, then add the scraper from the
# tarball so npm resolves its transitive dependencies normally.
RUN node docker/prepare-deps.js \
    && npm install --omit=dev --no-audit --no-fund \
    && npm install --omit=dev --no-audit --no-fund /tmp/israeli-bank-scrapers.tgz \
    && rm -rf docker

# ---------------------------------------------------------------------------
# Stage 3 - runtime.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# Shared libraries Chrome needs. Chrome itself is installed further down through
# Puppeteer, so the browser build always matches the Puppeteer version in use.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        fonts-liberation \
        fonts-noto-color-emoji \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libglib2.0-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libx11-6 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_CACHE_DIR=/home/app/.cache/puppeteer

WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src

# Chrome refuses to run as root without --no-sandbox; running as a normal user keeps
# the sandbox available and is good practice regardless.
RUN groupadd -r app \
    && useradd -r -g app -G audio,video -m -d /home/app app \
    && chown -R app:app /app /home/app

USER app

# Downloads the Chrome build that this Puppeteer version expects.
RUN ./node_modules/.bin/puppeteer browsers install chrome

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
