FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all deps (need devDeps for build)
RUN npm ci

# Copy source
COPY . .

# Build the project
RUN npm run build

ENV NODE_ENV=production

# Railway injects PORT automatically
EXPOSE 5000

CMD ["node", "dist/index.cjs"]
