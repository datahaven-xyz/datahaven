# Use a specific Ubuntu version similar to the official image
FROM ubuntu:22.04

# Copy the relayer binary from the build context into the image.
# The build context is set to the project root by the script (test/../).
# The binary is placed in test/tmp/bin/snowbridge-relay by the script.
# So, the path relative to the context is 'test/tmp/bin/snowbridge-relay'.
COPY test/tmp/bin/snowbridge-relay /usr/local/bin/snowbridge-relay

# Ensure the binary is executable
RUN chmod +x /usr/local/bin/snowbridge-relay

# Add VOLUME instruction to match official image
VOLUME ["/config"]

# Set the entrypoint for the container
# By not specifying a USER, this will run as root by default.
ENTRYPOINT ["/usr/local/bin/snowbridge-relay"]
