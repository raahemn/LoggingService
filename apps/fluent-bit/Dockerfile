FROM fluent/fluent-bit:2.2

# Copy parsers configuration
COPY parsers.conf /fluent-bit/etc/parsers.conf

# Create storage directory for state and buffering
VOLUME ["/fluent-bit/storage"]

# Set the default command to use your config
CMD ["/fluent-bit/bin/fluent-bit", "-c", "/fluent-bit/etc/fluent-bit.conf"]