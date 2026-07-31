# Queue-Based Bank Scraping System Setup Guide

This document provides instructions for setting up and using the new queue-based bank scraping system.

## 🚀 Quick Start

### 1. Start Redis and MongoDB Services

```bash
# Start both Redis and MongoDB using Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
# MongoDB Configuration
MONGO_PORT=27777
MONGO_ROOT_USERNAME=your_username
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_DATABASE=gerifinancial

# Redis Configuration
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_HOST=localhost
REDIS_DB=0
```

### 3. Test the Queue System

```bash
# Run the queue system test
cd backend && node test-queue-system.js
```

## 📋 System Overview

### Architecture Components

1. **ScrapingQueueService**: Core Bull queue manager with 3 priority levels
2. **ScrapingJobProcessors**: Generic job processors for all strategy types
3. **QueuedDataSyncService**: High-level coordination service
4. **BankAccountService**: Enhanced with queue-based methods
5. **API Routes**: Updated to use queue system

### Queue Priorities

- **High Priority** (3 workers): New accounts, manual requests
- **Normal Priority** (5 workers): Regular scheduled scraping
- **Low Priority** (2 workers): Background maintenance tasks

## 🔧 API Endpoints

### Queue Scraping Jobs

```bash
# Queue all strategies for all user accounts
POST /api/bank-accounts/scrape-all
Content-Type: application/json
{
  "priority": "normal"  # optional: high, normal, low
}

# Queue all strategies for specific account
POST /api/bank-accounts/:accountId/scrape
Content-Type: application/json
{
  "priority": "high"  # optional
}

# Queue specific strategy for specific account
POST /api/bank-accounts/:accountId/scrape/:strategy
# Strategies: checking-accounts, investment-portfolios, foreign-currency
Content-Type: application/json
{
  "priority": "normal"  # optional
}
```

### Queue Monitoring

```bash
# Get queue statistics
GET /api/bank-accounts/queue/stats

# Get queue health status
GET /api/bank-accounts/queue/health
```

## 🎯 Job Types and Strategies

### Available Strategies

1. **checking-accounts**: Regular transactions (checking, savings, credit cards)
2. **investment-portfolios**: Investment accounts and transactions
3. **foreign-currency**: Foreign currency accounts and exchanges

### Job Flow

1. **Producer**: API endpoints add jobs to appropriate priority queue
2. **Consumer**: Workers process jobs using strategy pattern
3. **Processing**: Each strategy runs isolated scraping for specific account type
4. **Results**: Success/failure tracked with comprehensive error handling

## 🔍 Monitoring and Management

### Queue Statistics Response

```json
{
  "scraping-high": {
    "queueName": "scraping-high",
    "waiting": 0,
    "active": 1,
    "completed": 5,
    "failed": 0,
    "delayed": 0,
    "paused": 0,
    "total": 6
  },
  "scraping-normal": { ... },
  "scraping-low": { ... }
}
```

### Health Check Response

```json
{
  "status": "healthy",
  "queues": 3,
  "stats": { ... }
}
```

## 🐛 Troubleshooting

### Redis Connection Issues

1. **Check Redis is running**:
   ```bash
   docker-compose ps redis
   ```

2. **Check Redis logs**:
   ```bash
   docker-compose logs redis
   ```

3. **Test Redis connection**:
   ```bash
   docker exec -it gerifinancial_redis redis-cli ping
   ```

### Queue Not Processing Jobs

1. **Check queue health**: `GET /api/bank-accounts/queue/health`
2. **Check queue stats**: `GET /api/bank-accounts/queue/stats`
3. **Restart services**: `docker-compose restart`

### Common Error Messages

- **"connect ECONNREFUSED 127.0.0.1:6379"**: Redis not running
- **"MaxRetriesPerRequestError"**: Redis connection timeout
- **"Strategy not found"**: Invalid strategy name in job data

## ⚡ Performance Tuning

### Queue Concurrency

Edit `backend/src/shared/services/scrapingQueue.js`:

```javascript
this.queueConfigs = {
  'scraping-high': {
    concurrency: 3,  // Adjust based on system resources
    // ...
  },
  'scraping-normal': {
    concurrency: 5,  // Higher for normal load
    // ...
  },
  'scraping-low': {
    concurrency: 2,  // Lower for background tasks
    // ...
  }
};
```

### Redis Configuration

For production, consider:

```yaml
# In docker-compose.yml
redis:
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

## 🔒 Security Considerations

### Redis Security

1. **Set Redis password** in production:
   ```env
   REDIS_PASSWORD=your_secure_redis_password
   ```

2. **Network isolation**: Keep Redis in private network
3. **Firewall rules**: Restrict Redis port access

### Environment Variables

- Never commit `.env` files to version control
- Use different credentials for each environment
- Rotate passwords regularly

## 📊 Production Deployment

### Environment Setup

1. **Production Redis**: Use managed Redis service (AWS ElastiCache, etc.)
2. **Scaling**: Deploy multiple backend instances with shared Redis
3. **Monitoring**: Set up queue monitoring and alerting
4. **Backup**: Configure Redis persistence and backups

### Docker Production

```yaml
# Production docker-compose.yml additions
redis:
  deploy:
    resources:
      limits:
        cpus: '0.50'
        memory: 512M
      reservations:
        memory: 256M
```

## 🧪 Testing

### Manual Testing

```bash
# Test with existing bank account
curl -X POST http://localhost:3001/api/bank-accounts/ACCOUNT_ID/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"priority": "high"}'

# Check results
curl http://localhost:3001/api/bank-accounts/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Automated Testing

```bash
# Run queue system tests
cd backend && npm test -- --grep "queue"

# Run integration tests
cd backend && npm run test:integration
```

## 📚 Additional Resources

- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Redis Documentation](https://redis.io/documentation)
- [Docker Compose Reference](https://docs.docker.com/compose/)

## 🆘 Support

For issues with the queue system:

1. Check logs: `docker-compose logs`
2. Verify configuration: Review `.env` file
3. Test connectivity: Use health check endpoints
4. Review queue stats: Monitor job processing
