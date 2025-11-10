FROM alpine:latest AS build
WORKDIR /datahaven

ENV RUSTUP_HOME="/usr/local/rustup" CARGO_HOME="/usr/local/cargo" PATH="/usr/local/cargo/bin:$PATH" RUSTFLAGS="-C target-feature=-crt-static"
RUN apk add git curl cmake make g++ clang clang-dev perl protobuf libc-dev openssl openssl-dev linux-headers rocksdb-dev libc6-compat

# RUN ln -s /usr/bin/x86_64-alpine-linux-musl-gcc /usr/bin/musl-gcc
# RUN ln -s /usr/bin/x86_64-alpine-linux-musl-g++ /usr/bin/musl-g++

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable-x86_64-unknown-linux-gnu

COPY . /datahaven
RUN cargo build --release

EXPOSE 30333 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]