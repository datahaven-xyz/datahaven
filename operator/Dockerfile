#  --- Analyze dependencies ---

FROM docker.io/paritytech/ci-unified:bullseye-1.85.0 AS chef

WORKDIR /datahaven

RUN cargo install cargo-chef --locked -q

COPY . .
RUN cargo chef prepare --recipe-path recipe.json


# --- Build dependencies ---
FROM docker.io/paritytech/ci-unified:bullseye-1.85.0 AS builder

WORKDIR /datahaven

RUN cargo install cargo-chef --locked -q
COPY --from=chef /datahaven/recipe.json recipe.json
RUN cargo chef cook --recipe-path recipe.json --release

# Copy the full workspace *after* the dep cache is warm.
COPY . .

RUN cargo build --locked --release --bin datahaven-node


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
