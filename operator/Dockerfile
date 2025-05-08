#  --- Analyze dependencies ---
FROM docker.io/paritytech/ci-unified:latest AS chef

WORKDIR /polkadot

RUN cargo install cargo-chef --locked -q

COPY . .
RUN cargo chef prepare --recipe-path recipe.json


# --- Build dependencies ---
FROM docker.io/paritytech/ci-unified:latest AS builder

WORKDIR /polkadot

RUN cargo install cargo-chef --locked -q
COPY --from=chef /polkadot/recipe.json recipe.json
RUN cargo chef cook --recipe-path recipe.json --release

# Copy the full workspace *after* the dep cache is warm.
COPY . .

RUN cargo build --locked --release --bin datahaven-node


# --- Prepare Runtime Environment ---
FROM docker.io/parity/base-bin:latest

COPY --from=builder /polkadot/target/release/datahaven-node /usr/local/bin

# --- Create minimal, non‑root runtime user ---
USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /polkadot polkadot && \
	mkdir -p /data /polkadot/.local/share && \
	chown -R polkadot:polkadot /data && \
	ln -s /data /polkadot/.local/share/polkadot && \
	# unclutter and minimise the attack surface
	rm -rf /usr/bin /usr/sbin && \
	# sanity check that the binary is runnable inside this image
	/usr/local/bin/datahaven-node --version

USER polkadot

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]
