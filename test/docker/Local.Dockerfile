FROM ubuntu:24.10
COPY ./operator/target/release/datahaven-node /usr/local/bin

USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /datahaven datahaven && \
    mkdir -p /data /datahaven/.local/share && \
    chown -R datahaven:datahaven /data && \
    ln -s /data /datahaven/.local/share/datahaven && \
    /usr/local/bin/datahaven-node --version

USER datahaven

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/datahaven-node"]