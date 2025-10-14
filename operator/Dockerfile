#  --- Setup Build Environment ---
FROM docker.io/paritytech/ci-unified:bullseye-1.88.0 AS base

ARG MOLD_VERSION=2.40.4
ARG PROTOC_VER=21.12
ARG SCCACHE_VERSION=0.10.0
ARG FAST_RUNTIME=FALSE
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    xz-utils \
    clang \
    libpq-dev \
    && echo "Installing mold v${MOLD_VERSION}..." \
    && curl -Lo mold.tar.gz "https://github.com/rui314/mold/releases/download/v${MOLD_VERSION}/mold-${MOLD_VERSION}-x86_64-linux.tar.gz" \
    && tar -xf mold.tar.gz --strip-components=1 -C /usr/local \
    && rm mold.tar.gz \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && echo "Installing protoc v${PROTOC_VER}..." \
    && curl -Lo protoc.zip "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VER}/protoc-${PROTOC_VER}-linux-x86_64.zip" \
    && unzip -q protoc.zip -d /usr/local/ \
    && rm protoc.zip \
    && echo "Installing sccache v${SCCACHE_VERSION}..." \
    && curl -Lo sccache.tar.gz "https://github.com/mozilla/sccache/releases/download/v${SCCACHE_VERSION}/sccache-v${SCCACHE_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    && tar -xf sccache.tar.gz --strip-components=1 -C /usr/local/bin sccache-v${SCCACHE_VERSION}-x86_64-unknown-linux-musl/sccache \
    && rm sccache.tar.gz

RUN cargo install cargo-chef --version 0.1.72 --locked

ENV RUSTC_WRAPPER=sccache \
    SCCACHE_DIR=/usr/local/sccache \
    SCCACHE_CACHE_SIZE=25G \
    RUSTFLAGS="-Clinker=clang -Clink-arg=-fuse-ld=/usr/local/bin/mold"

# --- Prepare build plan with cargo-chef ---
FROM base AS planner
WORKDIR /datahaven
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# --- Build dependencies using cargo-chef ---
FROM base AS builder
WORKDIR /datahaven
COPY --from=planner /datahaven/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo chef cook --recipe-path recipe.json --release
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    if [ "$FAST_RUNTIME" = "TRUE" ]; then \
        cargo build --locked --release --features fast-runtime; \
    else \
        cargo build --locked --release; \
    fi

# --- Create final lightweight runtime image ---
FROM docker.io/parity/base-bin:latest

RUN apt-get update && apt-get install -y libpq5

COPY --from=builder /datahaven/target/release/datahaven-node /usr/local/bin

USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven && \
    /usr/local/bin/datahaven-node --version

USER datahaven

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]