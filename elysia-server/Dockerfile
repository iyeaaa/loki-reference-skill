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
# Copy migration files
COPY drizzle ./drizzle
# Copy .env files
COPY .env* ./

# Expose port
EXPOSE 3001

# Start the application
CMD ["bun", "run", "start"]