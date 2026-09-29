FROM node:24-slim

WORKDIR /app

# /app belongs to the unprivileged `node` user from the base image, and every
# file below is copied with that owner, so the app (and Railway's pre-deploy
# migrate) can read everything without running as root. Chowning at COPY
# time avoids a separate `chown -R` layer that would duplicate node_modules.
RUN chown node:node /app

# Copy package files
COPY --chown=node:node package.json package-lock.json ./

USER node

# Install all deps. Dev dependencies are deliberately kept (no prune):
# the build needs them, and Railway's pre-deploy command
# `npx drizzle-kit migrate` runs inside this image.
RUN npm ci

# Copy source, including migrations/ and drizzle.config.ts
COPY --chown=node:node . .

# Build the project
RUN npm run build

ENV NODE_ENV=production

# Railway injects PORT automatically
EXPOSE 5000

USER node
CMD ["node", "dist/index.cjs"]
