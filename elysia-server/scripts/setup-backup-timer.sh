#!/bin/bash

# Systemd timer를 사용한 자동 백업 설정
# 사용법: sudo ./scripts/setup-backup-timer.sh

set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root: sudo $0"
  exit 1
fi

PROJECT_DIR="/home/ec2-user/send-grid-test/elysia-server"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/docker-backup-db.sh"

echo "🔄 Setting up backup timer..."

# Systemd service 파일 생성
cat > /etc/systemd/system/db-backup.service << EOF
[Unit]
Description=Database Backup Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$PROJECT_DIR
ExecStart=$BACKUP_SCRIPT
User=ec2-user
StandardOutput=append:$PROJECT_DIR/logs/backup.log
StandardError=append:$PROJECT_DIR/logs/backup.log

[Install]
WantedBy=multi-user.target
EOF

# Systemd timer 파일 생성 (매일 새벽 2시)
cat > /etc/systemd/system/db-backup.timer << EOF
[Unit]
Description=Daily Database Backup
Requires=db-backup.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Systemd 리로드
systemctl daemon-reload

# Timer 활성화 및 시작
systemctl enable db-backup.timer
systemctl start db-backup.timer

echo "✅ Backup timer setup completed!"
echo ""
echo "📋 Timer status:"
systemctl status db-backup.timer --no-pager
echo ""
echo "🔍 Next run:"
systemctl list-timers db-backup.timer --no-pager
echo ""
echo "💡 Useful commands:"
echo "  - Check timer status: systemctl status db-backup.timer"
echo "  - Check backup logs: tail -f $PROJECT_DIR/logs/backup.log"
echo "  - Run backup now: systemctl start db-backup.service"
echo "  - Stop timer: sudo systemctl stop db-backup.timer"
echo "  - Disable timer: sudo systemctl disable db-backup.timer"
