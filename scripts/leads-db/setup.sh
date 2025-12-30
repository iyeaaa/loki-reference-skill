#!/bin/bash
# Setup script for leads database on rinda-duckdb server

set -e

echo "=== Leads Database Setup ==="

# Install dependencies
echo "Installing dependencies..."
sudo dnf install -y docker postgresql16-devel gcc-c++ || \
sudo yum install -y docker postgresql-devel gcc-c++ || \
echo "Could not install packages, assuming they're already installed"

# Start Docker
echo "Starting Docker..."
sudo systemctl start docker 2>/dev/null || sudo service docker start || true
sudo systemctl enable docker 2>/dev/null || true

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create directory
cd /home/ec2-user
mkdir -p leads-db
cd leads-db

# Copy files (if running locally, use scp)
# scp docker-compose.yml init.sql import_leads.cpp ec2-user@rinda-duckdb:~/leads-db/

# Compile importer
echo "Compiling import tool..."
if [ -f import_leads.cpp ]; then
    g++ -O3 -std=c++17 -pthread -o import_leads import_leads.cpp -lpq -I/usr/include/postgresql
    echo "Compilation successful!"
else
    echo "import_leads.cpp not found, skipping compilation"
fi

# Start PostgreSQL with pgvector
echo "Starting PostgreSQL with pgvector..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
elif docker compose version &> /dev/null; then
    docker compose up -d
else
    echo "Docker Compose not found!"
    exit 1
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# Check connection
PGPASSWORD=D6HblnSek1IC51Qh5D76Kb7kdbsazdAQ psql -h localhost -p 5433 -U leads_admin -d leads_db -c "SELECT version();" && echo "PostgreSQL is ready!"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the import, run:"
echo "  ./import_leads -D /home/ec2-user/data_with_website -t \$(nproc)"
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 5433"
echo "  Database: leads_db"
echo "  User: leads_admin"
echo "  Password: D6HblnSek1IC51Qh5D76Kb7kdbsazdAQ"
