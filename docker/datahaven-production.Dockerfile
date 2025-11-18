# Production Image for DataHaven
#
# Requires to run from repository root and to copy the binary in the build folder (part of the release workflow)

FROM docker.io/library/ubuntu:22.04 AS builder

# Branch or tag to build DataHaven from
ARG COMMIT="main"
ARG RUSTFLAGS=""
ARG BUILD=""
ENV RUSTFLAGS=$RUSTFLAGS
ENV DEBIAN_FRONTEND=noninteractive
ENV PROTOC_VER=21.12

WORKDIR /

RUN echo "*** Installing Basic dependencies ***"
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates
RUN apt install --assume-yes git clang curl libldap2-dev libpq-dev libssl-dev llvm libudev-dev make pkg-config unzip

RUN echo "*** Installing protoc v${PROTOC_VER} ***"
RUN curl -Lo /tmp/protoc.zip "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VER}/protoc-${PROTOC_VER}-linux-x86_64.zip" \
	&& unzip -q /tmp/protoc.zip -d /usr/local/ \
	&& rm /tmp/protoc.zip

RUN set -e

RUN echo "*** Installing Rust environment ***"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:$PATH"
RUN rustup default stable
# rustup version are pinned in the rust-toolchain file

COPY ./operator /datahaven
WORKDIR /datahaven

# Print target cpu
RUN rustc --print target-cpus

RUN echo "*** Building DataHaven ***"
RUN if [ "$BUILD" = "static" ]; then \
        cargo build --profile=production --all --features static
    else \
        cargo build --profile=production --all
    fi

FROM debian:stable-slim
LABEL maintainer="steve@moonsonglabs.com"
LABEL description="Production Binary for DataHaven Nodes"

# Copy CA certificates and shared libraries from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder \
    /lib/x86_64-linux-gnu/libpq.so.5 \
    /lib/x86_64-linux-gnu/libssl.so.3 \
    /lib/x86_64-linux-gnu/libcrypto.so.3 \
    /lib/x86_64-linux-gnu/libgssapi_krb5.so.2 \
    /lib/x86_64-linux-gnu/libldap-2.5.so.0 \
    /lib/x86_64-linux-gnu/libz.so.1 \
    /lib/x86_64-linux-gnu/libzstd.so.1 \
    /lib/x86_64-linux-gnu/libkrb5.so.3 \
    /lib/x86_64-linux-gnu/libk5crypto.so.3 \
    /lib/x86_64-linux-gnu/libcom_err.so.2 \
    /lib/x86_64-linux-gnu/libkrb5support.so.0 \
    /lib/x86_64-linux-gnu/liblber-2.5.so.0 \
    /lib/x86_64-linux-gnu/libsasl2.so.2 \
    /lib/x86_64-linux-gnu/libkeyutils.so.1 \
    /lib/x86_64-linux-gnu/

# Create datahaven user and directories
RUN useradd -m -u 1000 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /datahaven/.local/share /data && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven && \
    rm -rf /usr/sbin

USER datahaven

COPY --from=builder --chown=datahaven /datahaven/target/production/datahaven-node /datahaven/datahaven-node

RUN chmod uog+x /datahaven/datahaven-node

# 30333 for parachain p2p
# 9944 for Websocket & RPC call
# 9615 for Prometheus (metrics)
EXPOSE 30333 9944 9615

VOLUME ["/data"]

ENTRYPOINT ["/datahaven/datahaven-node"]
