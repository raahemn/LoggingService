FROM fluent/fluentd:v1.16-1

# Switch to root user to install plugins
USER root

# Install build dependencies and MongoDB plugin
RUN apk add --no-cache --virtual .build-deps \
        build-base \
        ruby-dev \
    && gem install fluent-plugin-mongo \
    && apk del .build-deps

# Switch back to fluent user
USER fluent

# Copy configuration
COPY fluent.conf /fluentd/etc/fluent.conf

# Expose port
EXPOSE 24224
