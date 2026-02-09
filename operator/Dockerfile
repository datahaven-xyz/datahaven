# DataHaven Operator Image

FROM debian:stable-slim

LABEL version="0.4.0"
LABEL description="DataHaven Node - Release Build"
LABEL maintainer="steve@moonsonglabs.com"

# ENV BINARY_PATH=./target/x86_64-unknown-linux-gnu/release/datahaven-node

# Install CA certificates and libpq5 for the release build
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates && \
    update-ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create datahaven user and directories
RUN useradd -m -u 1001 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share && \
    chown -R datahaven:datahaven /data /datahaven/.local/share && \
    ln -s /data /datahaven/.local/share/datahaven-node


USER datahaven

# Copy pre-built binary
COPY . .
RUN cd target && ls
RUN mv target/x86_64-unknown-linux-gnu/release/datahaven-node /usr/local/bin
# COPY --chown=datahaven:datahaven ./target/x86_64-unknown-linux-gnu/release/datahaven-node /usr/local/bin
# Make binary executable
RUN chmod uog+x /usr/local/bin/datahaven-node

# Expose ports
# 30333: p2p networking
# 9944: WebSocket/RPC
# 9615: Prometheus metrics
EXPOSE 30333 9944 9615

ENTRYPOINT ["datahaven-node"]
