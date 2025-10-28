FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for Yarn Berry
RUN corepack enable

# Copy package files
COPY package*.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn

# Set environment variable to skip SWC binary check
ENV SKIP_SWCPACK_POSTINSTALL=true

# Install dependencies
RUN yarn install

# Copy source code including .env file
COPY . .

# Build the application (.env file will be automatically loaded by Vite)
RUN yarn build

# Production stage
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration for SPA
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # index.html은 캐시하지 않음 (항상 최신 버전 사용) \
    location = /index.html { \
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
        try_files $uri =404; \
    } \
    \
    # 정적 자산은 장기 캐시 (파일명에 해시가 포함되어 있음) \
    location ~* \\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        add_header Cache-Control "public, max-age=31536000, immutable"; \
        try_files $uri =404; \
    } \
    \
    # manifest와 기타 JSON 파일 \
    location ~* \\.(?:json)$ { \
        add_header Cache-Control "no-cache"; \
        try_files $uri =404; \
    } \
    \
    # SPA fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]