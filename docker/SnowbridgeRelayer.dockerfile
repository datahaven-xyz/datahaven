FROM ubuntu:22.04

WORKDIR /app

COPY test/configs/ ./config/
COPY .env ./

# Use --no-install-recommends to keep the image smaller
# Clean up apt cache afterwards
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY test/tmp/snowbridge-relay /usr/bin/snowbridge-relay
RUN chmod +x /usr/bin/snowbridge-relay

# EXPOSE 30333

ENTRYPOINT ["snowbridge-relay"]
CMD ["help"]
