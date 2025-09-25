FROM oven/bun:1.1.42-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Install dependencies with Yarn Berry
RUN corepack enable && \
    corepack prepare yarn@stable --activate && \
    yarn install --immutable

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Expose port
EXPOSE 3001

# Run the application
CMD ["bun", "run", "src/index.ts"]