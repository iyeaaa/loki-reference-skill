#!/bin/bash
# PostgreSQL Backup Script for SendGrinda
# Usage: ./backup-postgres.sh [manual|status|list]

set -e

BACKUP_DIR="$HOME/backups/postgres"
CONTAINER_NAME="send-grid-test-postgres-1"
DB_NAME="postgres"
DB_USER="postgres"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

create_manual_backup() {
    local backup_subdir="${BACKUP_DIR}/manual"
    local backup_file="${backup_subdir}/${DB_NAME}_manual_${TIMESTAMP}.dump"
    mkdir -p "${backup_subdir}"

    log "Starting manual backup..."

    if ! docker inspect ${CONTAINER_NAME} &>/dev/null; then
        log "ERROR: Container ${CONTAINER_NAME} not found!"
        exit 1
    fi

    docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} \
        --format=custom --compress=6 --no-owner --no-privileges \
        --file=/tmp/backup.dump 2>&1

    docker cp ${CONTAINER_NAME}:/tmp/backup.dump "${backup_file}"
    docker exec ${CONTAINER_NAME} rm -f /tmp/backup.dump

    if [ -f "${backup_file}" ]; then
        local size=$(du -h "${backup_file}" | cut -f1)
        log "SUCCESS: ${backup_file} (${size})"
        ln -sf "${backup_file}" "${backup_subdir}/latest.dump"
    else
        log "ERROR: Backup failed!"
        exit 1
    fi
}

show_status() {
    echo ""
    echo "=== PostgreSQL Backup Status ==="
    echo ""

    # Docker backup container status
    echo "Backup Container:"
    docker ps -a --filter "name=postgres-backup" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  (not found)"
    echo ""

    # Backup volumes
    echo "Backup Storage:"
    for type in pre-deploy manual; do
        if [ -d "${BACKUP_DIR}/${type}" ]; then
            count=$(find "${BACKUP_DIR}/${type}" -name "*.dump" 2>/dev/null | wc -l)
            size=$(du -sh "${BACKUP_DIR}/${type}" 2>/dev/null | cut -f1)
            printf "  %-12s %3d files, %s\n" "${type}:" "${count}" "${size}"
        fi
    done

    # Docker volume backups (from postgres-backup container)
    echo ""
    echo "Automated Backups (Docker Volume):"
    docker run --rm -v send-grid-test_postgres_backup:/backups alpine \
        sh -c "find /backups -name '*.dump' -o -name '*.sql*' 2>/dev/null | head -10" 2>/dev/null || echo "  (none)"

    echo ""
    echo "Total local backup size:"
    du -sh "${BACKUP_DIR}" 2>/dev/null | awk '{print "  " $1}' || echo "  (none)"

    echo ""
    echo "Recent logs:"
    tail -5 "${LOG_FILE}" 2>/dev/null || echo "  (no logs)"
}

list_backups() {
    echo ""
    echo "=== Available Backups ==="
    echo ""

    echo "Local Backups:"
    find ${BACKUP_DIR} -name "*.dump" -type f 2>/dev/null | sort -r | head -20 || echo "  (none)"

    echo ""
    echo "Docker Volume Backups:"
    docker run --rm -v send-grid-test_postgres_backup:/backups alpine \
        sh -c "find /backups -name '*.dump' -o -name '*.sql*' 2>/dev/null | sort -r | head -20" 2>/dev/null || echo "  (none)"
}

mkdir -p "${BACKUP_DIR}"
touch "${LOG_FILE}" 2>/dev/null || true

case "$1" in
    manual)
        log "=== Manual Backup Started ==="
        create_manual_backup
        log "=== Manual Backup Finished ==="
        ;;
    status)
        show_status
        ;;
    list)
        list_backups
        ;;
    *)
        echo "Usage: $0 [manual|status|list]"
        echo ""
        echo "Commands:"
        echo "  manual  - Create manual backup"
        echo "  status  - Show backup status"
        echo "  list    - List all available backups"
        echo ""
        echo "Note: Automated backups run every 6 hours via postgres-backup container"
        ;;
esac
