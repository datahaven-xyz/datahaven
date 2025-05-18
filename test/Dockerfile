# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /tmp/dev
COPY package.json bun.lock /tmp/dev/
COPY .papi /tmp/dev/.papi
RUN cd /tmp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /tmp/prod
COPY package.json bun.lock /tmp/prod/
COPY .papi /tmp/prod/.papi
RUN cd /tmp/prod && bun install --frozen-lockfile --production

# copy node_modules from tmp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /tmp/dev/node_modules node_modules
COPY .papi .papi
COPY cli cli
COPY contract-bindings contract-bindings
COPY scripts scripts
COPY utils utils
COPY tsconfig.json tsconfig.json

# copy production dependencies and source code into final image
FROM base AS release

COPY --from=install /tmp/prod/node_modules node_modules
COPY --from=install /tmp/prod/package.json package.json
COPY --from=prerelease /app/.papi .papi
COPY --from=prerelease /app/cli cli
COPY --from=prerelease /app/contract-bindings contract-bindings
COPY --from=prerelease /app/scripts scripts
COPY --from=prerelease /app/utils utils
COPY --from=prerelease /app/tsconfig.json tsconfig.json

# run the app
USER bun
# EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "cli/index.ts" ]
