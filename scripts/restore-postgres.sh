#!/bin/bash
# PostgreSQL Restore Script for SendGrinda
# Usage: ./restore-postgres.sh <backup_file.dump>

set -e

BACKUP_DIR="$HOME/backups/postgres"
CONTAINER_NAME="send-grid-test-postgres-1"
DB_NAME="postgres"
DB_USER="postgres"

list_backups() {
    echo ""
    echo "=== Available Backups ==="
    echo ""
    echo "Local backups:"
    find ${BACKUP_DIR} -name "*.dump" -type f 2>/dev/null | sort -r | head -20 || echo "  (none)"
    echo ""
    echo "Docker volume backups:"
    docker run --rm -v send-grid-test_postgres_backup:/backups alpine \
        sh -c "find /backups -name '*.dump' -o -name '*.sql*' 2>/dev/null | sort -r | head -20" 2>/dev/null || echo "  (none)"
    echo ""
    echo "To restore: $0 <backup_file_path>"
}

restore_backup() {
    local backup_file="$1"

    # Check if it's a Docker volume path
    if [[ "${backup_file}" == /backups/* ]]; then
        echo "[+] Restoring from Docker volume..."
        local temp_file="/tmp/restore_$(date +%s).dump"

        docker run --rm -v send-grid-test_postgres_backup:/backups -v /tmp:/tmp alpine \
            cp "${backup_file}" "${temp_file}"

        backup_file="${temp_file}"
    fi

    if [ ! -f "${backup_file}" ]; then
        echo "ERROR: File not found: ${backup_file}"
        exit 1
    fi

    echo ""
    echo "WARNING: This will REPLACE the current database!"
    echo "Backup file: ${backup_file}"
    echo ""
    read -p "Create pre-restore backup? (yes/no): " create_backup

    if [ "${create_backup}" = "yes" ]; then
        echo "[+] Creating pre-restore backup..."
        ./backup-postgres.sh manual
    fi

    read -p "Proceed with restore? (yes/no): " confirm

    if [ "${confirm}" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi

    echo "[$(date)] Starting restore..."

    docker cp "${backup_file}" ${CONTAINER_NAME}:/tmp/restore.dump

    docker exec ${CONTAINER_NAME} pg_restore -U ${DB_USER} -d ${DB_NAME} \
        --clean --if-exists --verbose \
        /tmp/restore.dump 2>&1 || true

    docker exec ${CONTAINER_NAME} rm -f /tmp/restore.dump

    echo "[$(date)] Restore completed!"
    echo ""
    echo "Verify with: docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -c '\\dt'"
}

case "$1" in
    ""|list)
        list_backups
        ;;
    *)
        restore_backup "$1"
        ;;
esac
