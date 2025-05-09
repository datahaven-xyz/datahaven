#  --- Setup Build Environment ---
FROM docker.io/paritytech/ci-unified:bullseye-1.85.0 AS base
RUN cargo install sccache --version ^0.10
RUN cargo install cargo-chef --version ^0.1.72
ENV RUSTC_WRAPPER=sccache SCCACHE_DIR=/sccache
RUN echo $CARGO_HOME

#  --- Analyze dependencies ---
FROM base as planner
WORKDIR /datahaven
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
	--mount=type=cache,target=/datahaven/target \
    --mount=type=cache,target=/sccache,sharing=locked \
    cargo chef prepare --recipe-path recipe.json


# --- Build dependencies ---
FROM base AS builder
WORKDIR /datahaven
COPY --from=planner /datahaven/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
	--mount=type=cache,target=/datahaven/target \
    --mount=type=cache,target=/sccache,sharing=locked \
    cargo chef cook --recipe-path recipe.json --release
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
	--mount=type=cache,target=/usr/local/cargo/git \
	--mount=type=cache,target=/datahaven/target \
	--mount=type=cache,target=/sccache,sharing=locked \
    cargo build --locked --release --bin datahaven-node


# --- Prepare Runtime Environment ---
FROM docker.io/parity/base-bin:latest

COPY --from=builder /datahaven/target/release/datahaven-node /usr/local/bin

# --- Create minimal, non‑root runtime user ---
USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /datahaven datahaven && \
	mkdir -p /data /datahaven/.local/share && \
	chown -R datahaven:datahaven /data && \
	ln -s /data /datahaven/.local/share/datahaven && \
	# unclutter and minimise the attack surface
	rm -rf /usr/bin /usr/sbin && \
	# sanity check that the binary is runnable inside this image
	/usr/local/bin/datahaven-node --version

USER datahaven

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]
