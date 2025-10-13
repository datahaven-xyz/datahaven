# DataHaven Binary
#
# Requires to run from repository root and to copy the binary in the build folder (part of the release workflow)

FROM debian:stable AS builder

RUN apt-get update && apt-get install -y libpq5 ca-certificates && update-ca-certificates

FROM debian:stable-slim
LABEL maintainer="steve@moonsonglabs.com"
LABEL description="DataHaven Binary"

RUN useradd -m -u 1000 -U -s /bin/sh -d /datahaven datahaven && \
	mkdir -p /datahaven/.local/share && \
	mkdir /data && \
	chown -R datahaven:datahaven /data && \
	ln -s /data /datahaven/.local/share/datahaven && \
	rm -rf /usr/sbin

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

USER datahaven

COPY --chown=datahaven build/* /datahaven
RUN chmod uog+x /datahaven/datahaven*

# 30333 for parachain p2p
# 9944 for Websocket & RPC call
# 9615 for Prometheus (metrics)
EXPOSE 30333 9944 9615

VOLUME ["/data"]

ENTRYPOINT ["/datahaven/datahaven-node"]
