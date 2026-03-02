#!/bin/bash

# MongoDB Backup Script
# This script creates a timestamped backup of your MongoDB database

# Configuration
BACKUP_DIR="./backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}"

# MongoDB connection details (adjust if needed)
MONGO_URI="mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "Starting MongoDB backup..."
echo "Backup location: ${BACKUP_PATH}"

# Perform the backup
mongodump --uri="${MONGO_URI}" --out="${BACKUP_PATH}"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully!"
    echo "Backup saved to: ${BACKUP_PATH}"
    
    # Optional: Keep only last 7 backups
    echo "Cleaning old backups (keeping last 7)..."
    cd "${BACKUP_DIR}" && ls -t | tail -n +8 | xargs -r rm -rf
    
    echo "Done!"
else
    echo "❌ Backup failed!"
    exit 1
fi
