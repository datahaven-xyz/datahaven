# Release Build Image for DataHaven Node
#
# This is a minimal image for release builds.
# Expects pre-built binary in build/ directory.
#
# Expected Binary:
#   build/datahaven-node
#
# The GitHub Actions workflow should handle building multiple CPU-optimized
# binaries using a matrix strategy, each creating a separate image tag.

FROM debian:stable AS builder

# Install CA certificates and libpq5 for the release build
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates && \
    update-ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

FROM debian:stable-slim

LABEL version="0.3.0"
LABEL description="DataHaven Node - Release Build"
LABEL maintainer="steve@moonsonglabs.com"

# Copy CA certificates and libpq5 libraries from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/lib/x86_64-linux-gnu/libpq.so* /usr/lib/x86_64-linux-gnu/

# Create datahaven user and directories
RUN useradd -m -u 1000 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /datahaven/.local/share /data && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven && \
    rm -rf /usr/sbin

USER datahaven

# Copy pre-built binary
COPY --chown=datahaven:datahaven build/* /datahaven

# Make binary executable
RUN chmod uog+x /datahaven/datahaven*

# Expose ports
# 30333: p2p networking
# 9944: WebSocket/RPC
# 9615: Prometheus metrics
EXPOSE 30333 9944 9615

VOLUME ["/data"]

ENTRYPOINT ["/datahaven/datahaven-node"]
