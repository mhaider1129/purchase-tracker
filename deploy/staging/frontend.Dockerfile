ARG NODE_IMAGE
FROM ${NODE_IMAGE}
WORKDIR /app
COPY --chown=node:node build/ ./build/
COPY --chown=node:node frontend-server.cjs ./
USER node
EXPOSE 8080
CMD ["node", "frontend-server.cjs"]
