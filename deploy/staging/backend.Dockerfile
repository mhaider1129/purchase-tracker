# Build only the authenticated backend release payload, never the repository or .env.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --omit=dev --ignore-scripts && npm rebuild bcrypt && npm cache clean --force
COPY --chown=node:node . .
USER node
EXPOSE 15051
CMD ["node", "app.js"]
