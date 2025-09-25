FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY yarn.lock* ./
COPY .yarnrc.yml* ./
COPY .yarn* ./.yarn

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY .env* ./

# Expose port
EXPOSE 3001

# Run the application
CMD ["bun", "run", "src/index.ts"]