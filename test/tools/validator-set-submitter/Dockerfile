# Validator Set Submitter image
#
# Build from the repository root:
#   docker build -f test/tools/validator-set-submitter/Dockerfile \
#     -t datahavenxyz/validator-set-submitter:local .
#
# Runtime expectations:
#   - Mount a config file at /config/config.yml
#   - Provide SUBMITTER_PRIVATE_KEY (or pass --submitter-private-key)
#   - Set service_manager_address in config.yml (contracts/deployments is not in the image)

FROM oven/bun:1.3.3-slim AS deps

WORKDIR /app/test

COPY test/package.json test/bun.lock test/tsconfig.json ./
COPY test/.papi ./.papi
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.3-slim

WORKDIR /app/test

RUN useradd -m -u 1001 -U -s /bin/sh -d /submitter submitter

COPY --from=deps /app/test/node_modules ./node_modules
COPY test/tsconfig.json test/bunfig.toml ./
COPY test/tools/validator-set-submitter/ ./tools/validator-set-submitter/
COPY test/contract-bindings/ ./contract-bindings/
COPY test/utils/ ./utils/

ENV NODE_ENV=production

USER submitter

ENTRYPOINT ["bun", "run", "tools/validator-set-submitter/main.ts", "run"]
CMD ["--config", "/config/config.yml"]
