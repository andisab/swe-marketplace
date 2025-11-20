# Node.js Development Guide

## Build & Run Commands

### Using Bun runtime (recommended for development)
- Run server: `bun run server.js`
- Run with watch: `bun --watch server.js`
- Production: `bun run --production server.js`

### Using Node.js
- Run server: `node server.js`
- Run with watch: `node --watch server.js` (Node 18+)
- Debug: `node --inspect server.js`
- Production: `NODE_ENV=production node server.js`

### Process management
- Development: Use built-in `--watch` flag
- Production: Use systemd or PM2
- Health checks: Implement `/health` endpoint
- Graceful shutdown: Handle SIGTERM properly

## Technical Stack

- **Node.js version**: 20.x LTS (use latest LTS)
- **Package manager**: pnpm for monorepos, Bun for speed, npm for compatibility
- **Framework**: Fastify for APIs, Express for legacy
- **Process manager**: PM2 or native systemd
- **Database drivers**: Use official drivers (pg, mongodb, redis)
- **HTTP client**: Native fetch (Node 18+) or undici
- **Logging**: Pino for structured logging
- **Environment**: dotenv for config, never commit .env files

## Application Structure

```
src/
├── api/                 # HTTP layer
│   ├── routes/
│   ├── middleware/
│   └── validators/
├── services/           # Business logic
│   ├── user/
│   └── auth/
├── repositories/       # Data access
│   └── postgres/
├── config/            # Configuration
│   ├── database.js
│   └── server.js
├── utils/             # Shared utilities
└── index.js           # Entry point
```

## Core Node.js Patterns

### Module System (ES Modules)
```javascript
// package.json
{
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  }
}

// Named exports preferred
export function processUser(data) { }
export class UserService { }

// Import with extensions
import { UserService } from './services/user.js'
```

### Error Handling
```javascript
// Global error handler
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection')
  process.exit(1)
})

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT']
signals.forEach(signal => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully`)
    await server.close()
    await database.disconnect()
    process.exit(0)
  })
})
```

### Configuration Management
```javascript
// config/index.js - Single source of truth
import { z } from 'zod'

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info')
})

export const config = ConfigSchema.parse(process.env)
```

## Performance Optimization

### Memory Management
```javascript
// Monitor heap usage
const v8 = require('v8')
setInterval(() => {
  const heapStats = v8.getHeapStatistics()
  const heapUsed = heapStats.used_heap_size / 1024 / 1024
  logger.info({ heapUsedMB: heapUsed }, 'Heap usage')
}, 60000)

// Optimize V8 for your workload
// Large applications:
// node --max-old-space-size=4096 server.js
// High throughput:
// node --max-semi-space-size=64 server.js
```

### Worker Threads for CPU-Intensive Tasks
```javascript
import { Worker, isMainThread, parentPort } from 'worker_threads'

// Main thread
export async function processLargeDataset(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/process-data.js', {
      workerData: data
    })
    
    worker.on('message', resolve)
    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  })
}

// Worker thread (workers/process-data.js)
if (!isMainThread) {
  const result = expensiveOperation(workerData)
  parentPort.postMessage(result)
}
```

### Stream Processing
```javascript
// Handle large files efficiently
import { pipeline } from 'stream/promises'
import { createReadStream, createWriteStream } from 'fs'
import { Transform } from 'stream'

async function processLargeFile(inputPath, outputPath) {
  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      // Process chunk
      const processed = chunk.toString().toUpperCase()
      callback(null, processed)
    }
  })

  await pipeline(
    createReadStream(inputPath),
    transformStream,
    createWriteStream(outputPath)
  )
}
```

## Security Best Practices

### Input Validation & Sanitization
```javascript
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', limiter)

// Input validation with Zod
import { z } from 'zod'

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  age: z.number().int().positive().max(120)
})

app.post('/users', async (req, res) => {
  try {
    const data = CreateUserSchema.parse(req.body)
    // Process validated data
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' })
  }
})
```

### Secure Dependencies
```bash
# Audit dependencies regularly
npm audit
npm audit fix

# Lock file for reproducible installs
npm ci --production

# Minimal production dependencies
npm prune --production
```

## Database Patterns

### Connection Pooling
```javascript
// PostgreSQL example
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Always use pool, not client
export async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  logger.debug({ text, duration, rows: res.rowCount }, 'Executed query')
  return res
}
```

### Transaction Handling
```javascript
export async function transferMoney(fromId, toId, amount) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId])
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
```

## Testing Patterns

### Integration Testing
```javascript
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

describe('API Integration', () => {
  let server
  
  beforeAll(async () => {
    server = await createServer()
    await server.listen({ port: 0 }) // Random port
  })
  
  afterAll(async () => {
    await server.close()
  })
  
  it('should create a user', async () => {
    const response = await fetch(`${server.url}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    })
    
    expect(response.status).toBe(201)
    const user = await response.json()
    expect(user.email).toBe('test@example.com')
  })
})
```

## Production Checklist

- **Logging**: Structured JSON logs with correlation IDs
- **Monitoring**: Health endpoints, metrics export
- **Error tracking**: Sentry or similar service
- **Secrets**: Use environment variables or secret manager
- **Dependencies**: Lock files, security audits, minimal deps
- **Graceful shutdown**: Handle SIGTERM, drain connections
- **Resource limits**: Set memory limits, file descriptor limits
- **Clustering**: Use PM2 or native cluster module for multi-core