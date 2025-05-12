#  --- Setup Build Environment ---
FROM docker.io/paritytech/ci-unified:bullseye-1.85.0 AS base

ARG MOLD_VERSION=2.39.0
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    xz-utils \
    clang \
    && echo "Installing mold v${MOLD_VERSION}..." \
    && curl -Lo mold.tar.gz "https://github.com/rui314/mold/releases/download/v${MOLD_VERSION}/mold-${MOLD_VERSION}-x86_64-linux.tar.gz" \
    && tar -xf mold.tar.gz --strip-components=1 -C /usr/local \
    && rm mold.tar.gz \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install sccache --version 0.10.0 --locked
RUN cargo install cargo-chef --version 0.1.71 --locked

ENV RUSTC_WRAPPER=sccache \
    SCCACHE_DIR=/var/cache/sccache \
    SCCACHE_CACHE_SIZE=25G \
    RUSTFLAGS="-Clinker=clang -Clink-arg=-fuse-ld=/usr/local/bin/mold"

# --- Prepare build plan with cargo-chef ---
FROM base AS planner
WORKDIR /datahaven
COPY ./operator/ .
RUN cargo chef prepare --recipe-path recipe.json

# --- Build dependencies using cargo-chef ---
FROM base AS builder
WORKDIR /datahaven
COPY --from=planner /datahaven/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/var/cache/sccache,sharing=locked \
    cargo chef cook --recipe-path recipe.json --release
COPY ./operator/ .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/var/cache/sccache,sharing=locked \
    cargo build --locked --release

RUN output=$(sccache --show-stats) && echo "${output}"

# --- Create final lightweight runtime image ---
FROM docker.io/parity/base-bin:latest
COPY --from=builder /datahaven/target/release/datahaven-node /usr/local/bin

USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven && \
    rm -rf /usr/bin /usr/sbin && \
    /usr/local/bin/datahaven-node --version

USER datahaven

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]