# Production Node for DataHaven
#
# Requires to run from repository root and to copy the binary in the build folder (part of the release workflow)

FROM docker.io/library/ubuntu:22.04 AS builder

# Branch or tag to build DataHaven from
ARG COMMIT="main"
ARG RUSTFLAGS=""
ENV RUSTFLAGS=$RUSTFLAGS
ENV DEBIAN_FRONTEND=noninteractive
ENV PROTOC_VER=21.12

WORKDIR /

RUN echo "*** Installing Basic dependencies ***"
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates
RUN apt install --assume-yes git clang curl libpq-dev libssl-dev llvm libudev-dev make protobuf-compiler pkg-config unzip

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
RUN cargo build --profile=production --all

FROM debian:stable-slim
LABEL maintainer="steve@moonsonglabs.com"
LABEL description="Production Binary for DataHaven Nodes"

RUN apt-get update && apt-get install -y libpq5

RUN useradd -m -u 1000 -U -s /bin/sh -d /datahaven datahaven && \
	mkdir -p /datahaven/.local/share && \
	mkdir /data && \
	chown -R datahaven:datahaven /data && \
	ln -s /data /datahaven/.local/share/datahaven && \
	rm -rf /usr/sbin

USER datahaven

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder --chown=datahaven /datahaven/target/production/datahaven-node /datahaven/datahaven-node

RUN chmod uog+x /datahaven/datahaven-node

# 30333 for parachain p2p
# 9944 for Websocket & RPC call
# 9615 for Prometheus (metrics)
EXPOSE 30333 9944 9615

VOLUME ["/data"]

ENTRYPOINT ["/datahaven/datahaven-node"]
