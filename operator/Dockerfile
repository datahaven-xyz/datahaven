# DataHaven Operator Image
#
# This is the standard operator image used for CI and release builds.
# It's a minimal image that accepts a pre-built binary.
#
# Usage:
#   - CI builds: Binary from build-operator workflow artifact
#   - Release builds: Binary from build-operator workflow artifact
#   - Local builds: Binary from local cargo build
#
# Expected Binary Location:
#   build/datahaven-node
#
# Registries:
#   - GHCR: ghcr.io/datahaven-xyz/datahaven/datahaven (CI)
#   - DockerHub: datahavenxyz/datahaven (releases)

FROM debian:stable-slim

LABEL version="0.3.0"
LABEL description="DataHaven Node - Release Build"
LABEL maintainer="steve@moonsonglabs.com"

# Install CA certificates and libpq5 for the release build
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates && \
    update-ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create datahaven user and directories
RUN useradd -m -u 1000 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /datahaven/.local/share /data && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven

USER datahaven

# Copy pre-built binary
COPY --chown=datahaven:datahaven ./operator/target/release/datahaven-node /usr/local/bin
# Make binary executable
RUN chmod uog+x /usr/local/bin/datahaven*


RUN /usr/local/bin/datahaven-node --version

# Expose ports
# 30333: p2p networking
# 9944: WebSocket/RPC
# 9615: Prometheus metrics
EXPOSE 30333 9944 9615

VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]
