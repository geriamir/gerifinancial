# MongoDB Backup & Recovery Procedures

## Overview

This document outlines backup and recovery procedures for the MongoDB database to prevent data loss.

## Automated Backup Script

A backup script is provided at `scripts/backup-mongodb.sh` that:
- Creates timestamped backups in `./backups/mongodb/`
- Automatically retains only the last 7 backups
- Can be run manually or scheduled via cron

### Manual Backup

```bash
# Make the script executable (first time only)
chmod +x scripts/backup-mongodb.sh

# Run the backup
./scripts/backup-mongodb.sh
```

### Scheduled Backups (Optional)

To schedule daily backups at 2 AM, add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path as needed)
0 2 * * * cd /path/to/gerifinancial && ./scripts/backup-mongodb.sh >> ./backups/backup.log 2>&1
```

## Manual Backup Commands

### Full Database Backup

```bash
mongodump --uri="mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin" --out=./backups/manual_backup
```

### Specific Collection Backup

```bash
mongodump --uri="mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin" --collection=transactions --out=./backups/transactions_backup
```

## Restore Procedures

### Restore Full Database

```bash
mongorestore --uri="mongodb://admin:password123@localhost:27777/?authSource=admin" ./backups/mongodb/backup_20250102_140000
```

### Restore Specific Collection

```bash
mongorestore --uri="mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin" --collection=transactions ./backups/transactions_backup/gerifinancial/transactions.bson
```

### Drop Existing Database Before Restore

```bash
mongorestore --uri="mongodb://admin:password123@localhost:27777/?authSource=admin" --drop ./backups/mongodb/backup_20250102_140000
```

## Data Persistence Changes

**Important Update:** As of the latest configuration:
- MongoDB data is stored in `./data/mongodb/` (local directory)
- Redis data is stored in `./data/redis/` (local directory)
- Data persists even if Docker Desktop is removed or reinstalled
- Both directories are excluded from git via `.gitignore`

## Best Practices

1. **Regular Backups**: Run backups before major changes or updates
2. **Test Restores**: Periodically test your restore procedures
3. **Off-site Backups**: Consider copying backups to cloud storage or external drives
4. **Pre-Migration Backups**: Always backup before database migrations
5. **Version Control**: Keep backup scripts in version control

## Backup Storage

- **Local Backups**: `./backups/mongodb/` (excluded from git)
- **Data Directory**: `./data/mongodb/` (excluded from git)
- **Recommended**: Copy backups to external storage regularly

## Quick Reference

```bash
# Backup
./scripts/backup-mongodb.sh

# List backups
ls -lh ./backups/mongodb/

# Restore latest backup
LATEST=$(ls -t ./backups/mongodb/ | head -1)
mongorestore --uri="mongodb://admin:password123@localhost:27777/?authSource=admin" --drop "./backups/mongodb/${LATEST}"

# Export to JSON (for inspection)
mongoexport --uri="mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin" --collection=transactions --out=transactions.json --jsonArray

# Import from JSON
mongoimport --uri="mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin" --collection=transactions --file=transactions.json --jsonArray
```

## Troubleshooting

### mongodump/mongorestore not found
Install MongoDB Database Tools:
```bash
# Windows (via Chocolatey)
choco install mongodb-database-tools

# Or download from: https://www.mongodb.com/try/download/database-tools
```

### Connection refused
Ensure MongoDB is running:
```bash
docker-compose ps
docker-compose up -d mongodb
```

### Authentication failed
Verify credentials in your connection string match your Docker configuration.

## Emergency Recovery

If you've lost Docker data but have backups:
1. Reinstall Docker Desktop
2. Run `docker-compose up -d mongodb`
3. Restore from your most recent backup
4. Verify data integrity

## Support

For issues or questions, refer to:
- MongoDB documentation: https://docs.mongodb.com/database-tools/
- Project documentation: `DOCKER_MONGODB_SETUP.md`
