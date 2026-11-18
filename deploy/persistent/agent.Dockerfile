ARG CLI_IMAGE=docker:28-cli@sha256:625d9431a9f54c5a2bc90f24f0e1c3d55b1349fd857dd85035f98c2c9acbdd4d
FROM ${CLI_IMAGE} AS cli
FROM node:22-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d
RUN apt-get update && apt-get install --no-install-recommends -y python3 util-linux ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=cli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app
# Build context must be an explicit whitelist (see build-agent.cjs).
COPY scripts/ ./scripts/
COPY deploy/ ./deploy/
CMD ["flock", "-n", "/var/lib/scop-staging/controller.lock", "node", "scripts/persistent/agent.cjs"]
