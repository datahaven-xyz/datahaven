# Stage 1: Build libpq
FROM ubuntu:noble AS crossbuild-libpq-builder

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates libpq-dev

# Stage 2: Copy the compiled libpq.so to a more accessible directory
FROM ubuntu:noble AS crossbuild-libpq-artifacts

# Copy libpq.so from the crossbuild-libpq stage to the /artifacts directory
COPY --from=crossbuild-libpq-builder /usr/lib/x86_64-linux-gnu/libpq.so /artifacts/libpq.so
