# Memory Provider Testing Guide

This guide walks through testing all three memory providers in the FAF server demo.

## Prerequisites

1. Build the main framework and server demo:
```bash
cd /Users/anurag.sharan/repos/faf && npm run build
cd examples/server-demo && npm run build
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

## Test 1: In-Memory Provider (Default)

### Setup
```bash
# .env configuration
FAF_MEMORY_TYPE=memory
FAF_MEMORY_MAX_CONVERSATIONS=1000
FAF_MEMORY_MAX_MESSAGES=1000
```

### Run Server
```bash
npm run dev
```

### Expected Output
```
🚀 Starting FAF Development Server (Functional)...
🔧 Setting up memory provider...
💾 Memory provider type: memory
[MEMORY:InMemory] Initialized with max 1000 conversations, 1000 messages each
✅ Memory provider (memory) initialized successfully
🚀 FAF Server running on http://127.0.0.1:3000
🧠 Memory provider: Configured
```

### Test Commands
```bash
# Test conversation persistence within same session
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Calculate 5 + 3"}],"conversationId":"test-memory-1","agentName":"MathTutor","context":{"userId":"test","permissions":["user"]}}'

curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What was my previous calculation?"}],"conversationId":"test-memory-1","agentName":"MathTutor","context":{"userId":"test","permissions":["user"]}}'

# Test memory health
curl http://localhost:3000/memory/health
```

## Test 2: Redis Provider

### Prerequisites
Start Redis server:
```bash
# Using Docker (recommended)
docker run -d --name faf-redis -p 6379:6379 redis:alpine

# Or using local Redis
brew install redis && brew services start redis  # macOS
sudo apt install redis-server && sudo systemctl start redis-server  # Ubuntu
```

### Setup
```bash
# .env configuration
FAF_MEMORY_TYPE=redis
FAF_REDIS_HOST=localhost
FAF_REDIS_PORT=6379
FAF_REDIS_DB=0
FAF_REDIS_PREFIX=faf:memory:
```

### Run Server
```bash
npm run dev
```

### Expected Output
```
🚀 Starting FAF Development Server (Functional)...
🔧 Setting up memory provider...
💾 Memory provider type: redis
🔗 Setting up Redis client...
✅ Redis client connected
✅ Memory provider (redis) initialized successfully
🚀 FAF Server running on http://127.0.0.1:3000
🧠 Memory provider: Configured
```

### Test Commands
```bash
# Test conversation persistence
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Calculate 10 * 4"}],"conversationId":"test-redis-1","agentName":"MathTutor","context":{"userId":"test","permissions":["user"]}}'

# Stop and restart server, then test persistence
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What was my previous calculation?"}],"conversationId":"test-redis-1","agentName":"MathTutor","context":{"userId":"test","permissions":["user"]}}'

# Check Redis directly
docker exec faf-redis redis-cli KEYS "faf:memory:*"
docker exec faf-redis redis-cli GET "faf:memory:test-redis-1"
```

### Cleanup
```bash
docker stop faf-redis && docker rm faf-redis
```

## Test 3: PostgreSQL Provider

### Prerequisites
Start PostgreSQL server:
```bash
# Using Docker (recommended)
docker run -d --name faf-postgres \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=faf_memory \
  -p 5432:5432 \
  postgres:15

# Or using local PostgreSQL
brew install postgresql && brew services start postgresql  # macOS
createdb faf_memory  # macOS

sudo apt install postgresql postgresql-contrib  # Ubuntu
sudo systemctl start postgresql  # Ubuntu
sudo -u postgres createdb faf_memory  # Ubuntu
```

### Setup
```bash
# .env configuration
FAF_MEMORY_TYPE=postgres
FAF_POSTGRES_HOST=localhost
FAF_POSTGRES_PORT=5432
FAF_POSTGRES_DB=faf_memory
FAF_POSTGRES_USER=postgres
FAF_POSTGRES_PASSWORD=testpass
FAF_POSTGRES_SSL=false
FAF_POSTGRES_TABLE=conversations
```

### Run Server
```bash
npm run dev
```

### Expected Output
```
🚀 Starting FAF Development Server (Functional)...
🔧 Setting up memory provider...
💾 Memory provider type: postgres
🔗 Setting up PostgreSQL client...
✅ PostgreSQL client connected
[MEMORY:Postgres] Schema initialized for table conversations
✅ Memory provider (postgres) initialized successfully
🚀 FAF Server running on http://127.0.0.1:3000
🧠 Memory provider: Configured
```

### Test Commands
```bash
# Test conversation persistence
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Calculate 7 * 8"}],"conversationId":"test-postgres-1","agentName":"MathTutor","context":{"userId":"test","permissions":["user"]}}'

# Stop and restart server, then test persistence
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What was my previous calculation?"}],"conversationId":"test-postgres-1","agentName":"MathTutor","context":{"userId":"test","permissions":["user"]}}'

# Check PostgreSQL directly
docker exec faf-postgres psql -U postgres -d faf_memory -c "SELECT * FROM conversations;"
```

### Cleanup
```bash
docker stop faf-postgres && docker rm faf-postgres
```

## Test Results Verification

For all providers, verify:

1. ✅ Server starts without errors
2. ✅ Memory provider initializes successfully
3. ✅ First conversation works and returns `conversationId`
4. ✅ Second conversation with same `conversationId` references previous context
5. ✅ Memory health endpoint returns healthy status
6. ✅ Conversation persistence across server restarts (Redis/PostgreSQL only)

## Troubleshooting

### Redis Connection Issues
- Ensure Redis server is running: `docker ps` or `brew services list`
- Check port availability: `lsof -i :6379`
- Verify credentials if using authentication

### PostgreSQL Connection Issues
- Ensure PostgreSQL server is running: `docker ps` or `brew services list`
- Check port availability: `lsof -i :5432`
- Verify database exists: `docker exec faf-postgres psql -U postgres -l`
- Check credentials and permissions

### Import Errors
- Ensure optional dependencies are installed: `npm install redis pg @types/pg`
- Check that the framework is built: `cd ../../ && npm run build`

## Performance Comparison

| Provider | Startup Time | Read Latency | Write Latency | Persistence | Scaling |
|----------|--------------|--------------|---------------|-------------|---------|
| Memory   | Instant      | <1ms         | <1ms          | None        | Single  |
| Redis    | ~100ms       | ~2ms         | ~3ms          | Full        | Multi   |
| PostgreSQL| ~200ms      | ~5ms         | ~10ms         | Full        | Multi   |

Choose the provider that best fits your deployment needs\!
EOF < /dev/null