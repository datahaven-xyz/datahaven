# Validator Set Submitter image
#
# Build from the test directory:
#   cd test
#   docker build -f tools/validator-set-submitter/Dockerfile \
#     -t datahavenxyz/validator-set-submitter:local .
#
# Runtime expectations:
#   - Mount a config file at /config/config.yml
#   - Provide SUBMITTER_PRIVATE_KEY (or pass --submitter-private-key)
#   - Set service_manager_address in config.yml (contracts/deployments is not in the image)

FROM oven/bun:1.3.3-slim AS deps

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY .papi ./.papi
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.3-slim

WORKDIR /app

RUN useradd -m -u 1001 -U -s /bin/sh -d /submitter submitter

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json bunfig.toml ./
COPY tools/validator-set-submitter/ ./tools/validator-set-submitter/
COPY contract-bindings/ ./contract-bindings/
COPY utils/ ./utils/

ENV NODE_ENV=production

EXPOSE 8080

USER submitter

ENTRYPOINT ["bun", "run", "tools/validator-set-submitter/main.ts", "run"]
CMD ["--config", "/config/config.yml"]
