# DATAHAVEN_NODE DOCKERFILE
#
# This Dockerfile expects to have the binary already built.
# So it just copies the binary into the image and runs it.
#
# This is done to speed up iterating while running the E2E CLI.
#
# Requires to run from /test folder and to copy the binary in the build folder

FROM ubuntu:noble

LABEL version="0.1.0"
LABEL description="DataHaven Node Local Build"

ENV RUST_BACKTRACE=1

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl sudo librocksdb-dev libpq-dev && \
    apt-get autoremove -y && \
    apt-get clean && \
    find /var/lib/apt/lists/ -type f -not -name lock -delete && \
    useradd -m -u 1337 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share /specs /storage && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven-node && \
    echo "datahaven ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    chmod -R 777 /storage /data

USER datahaven

COPY --chown=datahaven:datahaven ./operator/target/x86_64-unknown-linux-gnu/release/datahaven-node /usr/local/bin/datahaven-node
RUN chmod uog+x /usr/local/bin/datahaven-node

EXPOSE 9333 9944 30333 30334 9615

VOLUME ["/data"]

ENTRYPOINT ["datahaven-node"]
CMD ["--tmp"]