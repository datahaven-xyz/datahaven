## Fresh container that reproduce the build with the deps needed to build our binary.

FROM ubuntu:latest AS build
WORKDIR /datahaven

# Install deps needed for building the binary
RUN apt update && apt install -y curl build-essential protobuf-compiler pkg-config libssl-dev clang mold
# Install cargo
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

COPY . /datahaven
RUN cargo build --release

# Make sure the build work
RUN /datahaven/target/release/datahaven-node --version

EXPOSE 30333 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/datahaven/target/release/datahaven-node"]