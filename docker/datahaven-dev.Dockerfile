# Development/CI/E2E Testing Image for DataHaven Node
#
# This image is optimized for fast CI builds and E2E testing.
# It accepts pre-built binaries and supports optional debug mode.
#
# Build Args:
#   DEBUG_MODE - Set to "true" to include debugging tools (default: false)
#
# Expected Binary Location:
#   ./operator/target/x86_64-unknown-linux-gnu/release/datahaven-node
#
# Registry: ghcr.io/datahaven-xyz/datahaven/datahaven

FROM ubuntu:noble

LABEL version="0.3.0"
LABEL description="DataHaven Node - Development/CI/E2E Testing Build"
LABEL maintainer="steve@moonsonglabs.com"

ARG DEBUG_MODE=false

# Install runtime dependencies
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libpq-dev \
    librocksdb-dev && \
    # Optionally install debug tools
    if [ "$DEBUG_MODE" = "true" ]; then \
        apt-get install -y --no-install-recommends \
        sudo \
        gdb \
        strace \
        vim; \
    fi && \
    apt-get autoremove -y && \
    apt-get clean && \
    find /var/lib/apt/lists/ -type f -not -name lock -delete

# Create datahaven user and directories
RUN useradd -m -u 1000 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share /specs /storage && \
    chown -R datahaven:datahaven /data /storage && \
    ln -s /data /datahaven/.local/share/datahaven-node

# Grant sudo access if debug mode is enabled
RUN if [ "$DEBUG_MODE" = "true" ]; then \
        echo "datahaven ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
        chmod -R 777 /storage /data; \
    fi

USER datahaven

# Copy pre-built binary
COPY --chown=datahaven:datahaven ./operator/target/x86_64-unknown-linux-gnu/release/datahaven-node /usr/local/bin/datahaven-node
RUN chmod uog+x /usr/local/bin/datahaven-node

# Enable Rust backtraces for better debugging
ENV RUST_BACKTRACE=1

# Expose ports
# 30333: p2p networking
# 9944: WebSocket/RPC
# 9615: Prometheus metrics
EXPOSE 30333 9944 9615

VOLUME ["/data"]

ENTRYPOINT ["datahaven-node"]
CMD ["--tmp"]
