# Build stage
FROM golang:1.23.4-alpine AS builder

# Install git and essential build tools
RUN apk add --no-cache git

WORKDIR /app

# Copy go mod and sum files first for better caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code after dependencies
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api
# RUN GOOS=linux go build -o main ./cmd/api

# Production stage
FROM alpine:latest AS production

WORKDIR /app

# Add necessary runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN adduser -D -g '' appuser

# Copy only the binary from builder
COPY --from=builder /app/main .

# Copy only the production env file
COPY --from=builder /app/.env .env

# Use non-root user
USER appuser

# Expose the application port
EXPOSE 9888

# Run the binary
CMD ["./main"]