FROM node:24-alpine
WORKDIR /app/src/backend
# Only src/backend is copied (server.mjs, chat.mjs, optional summary.json). Secrets come from env at runtime.
COPY --chown=node:node . .
ENV PORT=8000
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8000/api/health || exit 1
CMD ["node", "server.mjs"]
