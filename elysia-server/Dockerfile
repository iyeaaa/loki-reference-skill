FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY bun.lockb* ./

# Install dependencies using bun
RUN bun install --frozen-lockfile || bun install

# Copy source code and configuration files
COPY src ./src
COPY tsconfig.json ./
COPY drizzle.config.ts ./
# Only copy drizzle folder if it exists
COPY drizzl[e] ./drizzle/ 2>/dev/null || true
COPY .env* ./

# Generate Drizzle migrations if needed
RUN bun run db:generate || true

# Expose port
EXPOSE 3001

# Run the application using bun
CMD ["bun", "run", "start"]