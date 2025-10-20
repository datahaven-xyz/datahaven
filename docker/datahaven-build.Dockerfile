#  --- Setup Build Environment ---
FROM rust:latest AS base

ARG MOLD_VERSION=2.40.4
ARG PROTOC_VER=21.12
ARG SCCACHE_VERSION=0.10.0
ARG FAST_RUNTIME=FALSE
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    xz-utils \
    clang \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && echo "Installing protoc v${PROTOC_VER}..." \
    && curl -Lo protoc.zip "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VER}/protoc-${PROTOC_VER}-linux-x86_64.zip" \
    && unzip -q protoc.zip -d /usr/local/ \
    && rm protoc.zip

# --- Build dependencies using cargo-chef ---
FROM base AS builder
WORKDIR /datahaven

COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    if [ "$FAST_RUNTIME" = "TRUE" ]; then \
        cargo build --locked --release --features fast-runtime; \
    else \
        cargo build --locked --release; \
    fi

# --- Create final lightweight runtime image ---
FROM debian:trixie-slim
COPY --from=builder /datahaven/target/release/datahaven-node /usr/local/bin

USER root
RUN apt-get update && apt-get install -y gcc libc6-dev libpq-dev && rm -rf /var/lib/apt/lists/* 
RUN useradd -m -u 1001 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven && \
    /usr/local/bin/datahaven-node --version

USER datahaven

EXPOSE 30333 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]