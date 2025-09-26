# MongoDB Docker Setup

This project uses Docker Compose to run MongoDB with proper separation between local development and production environments.

## Files Overview

- **`docker-compose.yml`** - Main configuration file (committed to git) - uses environment variables
- **`docker-compose.override.yml`** - Local development overrides (NOT committed to git) - contains local credentials
- **`.env.example`** - Template for environment variables
- **`.gitignore`** - Excludes sensitive files from git

## Local Development Setup

The setup automatically uses `docker-compose.override.yml` for local development, which contains:
- Default credentials (admin/password123)
- Port mapping (27777:27017)

### Quick Start

1. Start MongoDB:
   ```bash
   docker-compose up -d mongodb
   ```

2. Test connection:
   ```bash
   node test-mongo-connection.js
   ```

3. Stop MongoDB:
   ```bash
   docker-compose down
   ```

## Production Setup

For production environments:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your production values:
   ```bash
   MONGO_PORT=27017
   MONGO_ROOT_USERNAME=your_secure_username
   MONGO_ROOT_PASSWORD=your_secure_password
   MONGO_DATABASE=gerifinancial
   ```

3. Remove or rename `docker-compose.override.yml` to prevent local credentials from being used.

## Connection Details

### Local Development
- **Host:** localhost
- **Port:** 27777
- **Username:** admin
- **Password:** password123
- **Database:** gerifinancial
- **Connection String:** `mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin`

### Production
- Uses environment variables from `.env` file
- Default port: 27017 (unless specified in MONGO_PORT)

### Backend Configuration
The backend application requires the `MONGODB_URI` environment variable to be set in `backend/.env`:

```env
MONGODB_URI=mongodb://admin:password123@localhost:27777/gerifinancial?authSource=admin
```

**Important:** The connection string must include:
- Username and password for authentication
- `?authSource=admin` parameter for proper authentication
- Correct port (27777 for local development)

## Security Notes

- ✅ `docker-compose.override.yml` is excluded from git
- ✅ `.env` files are excluded from git
- ✅ Only `.env.example` is committed as a template
- ✅ Production credentials are never committed to source control

## Useful Commands

```bash
# View running containers
docker ps

# View logs
docker-compose logs mongodb

# Access MongoDB shell
docker exec -it gerifinancial_mongodb mongosh -u admin -p password123 --authenticationDatabase admin

# Reset everything (removes data!)
docker-compose down -v
