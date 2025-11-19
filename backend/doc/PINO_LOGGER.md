# Pino Logger Configuration

## Overview

The Trust-API uses **Pino**, an ultra-fast logger for Node.js, with colored formatting in development thanks to **pino-pretty**.

## Configuration

### Environment Variables

```env
# Log level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=info

# Environment (development/production)
NODE_ENV=development
```

## Log Levels

| Level | Priority | Usage |
|-------|----------|-------|
| `trace` | 10 | Very detailed information (advanced debugging) |
| `debug` | 20 | Debug information |
| `info` | 30 | General information (default) |
| `warn` | 40 | Warnings |
| `error` | 50 | Errors |
| `fatal` | 60 | Fatal errors that stop the application |

## Display Modes

### Development (NODE_ENV=development)
- Colored formatting with **pino-pretty**
- Human-readable display
- Timestamps in HH:MM:ss format
- No pid/hostname display

Example:
```
[14:30:25] INFO: Server is running on http://localhost:3000
    port: 3000
    resourceMode: "github"
```

### Production (NODE_ENV=production)
- Structured JSON format
- Optimized for performance
- Compatible with logging systems (Elasticsearch, CloudWatch, etc.)

Example:
```json
{"level":"INFO","time":"2025-11-18T14:30:25.123Z","port":3000,"resourceMode":"github","msg":"Server is running on http://localhost:3000"}
```

## Usage in Code

### Importing the Logger

```typescript
import { logger } from './utils/logger';
```

### Simple Logs

```typescript
logger.info('Server started');
logger.warn('This is a warning');
logger.error('Something went wrong');
```

### Logs with Context (recommended)

```typescript
// With structured data
logger.info({ port: 3000, mode: 'github' }, 'Server started');

// With errors
logger.error({ error: err.message, stack: err.stack }, 'Failed to process request');

// With user data
logger.warn({ userId: 123, ip: req.ip }, 'Rate limit exceeded');
```

### Conditional Logs

```typescript
// Only displays if LOG_LEVEL=debug or lower
logger.debug({ query: req.query }, 'Processing request');

// Only displays if LOG_LEVEL=trace or lower
logger.trace({ headers: req.headers }, 'Request details');
```

## HTTP Logger Middleware

The `httpLogger` middleware automatically logs all HTTP requests.

### Incoming Request
```
[14:30:25] INFO: → GET /service/nodejs
    type: "request"
    method: "GET"
    url: "/service/nodejs"
    ip: "::1"
    userAgent: "curl/7.68.0"
```

### Outgoing Response
```
[14:30:25] INFO: ← GET /service/nodejs 200 (45ms)
    type: "response"
    method: "GET"
    url: "/service/nodejs"
    statusCode: 200
    duration: "45ms"
    ip: "::1"
```

## Configuration Examples

### Development with Detailed Logs
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Development with Very Detailed Logs
```env
NODE_ENV=development
LOG_LEVEL=trace
```

### Production (Normal Logs)
```env
NODE_ENV=production
LOG_LEVEL=info
```

### Production (Minimal Logs)
```env
NODE_ENV=production
LOG_LEVEL=warn
```

## Error Logging

### In Routes

```typescript
app.get('/service/:name', async (req, res) => {
  try {
    const data = await getServiceData(req.params.name);
    res.json(data);
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      serviceName: req.params.name,
      stack: error.stack 
    }, 'Failed to get service data');
    
    res.status(500).json({ error: error.message });
  }
});
```

### In Middlewares

```typescript
export function myMiddleware() {
  return (req, res, next) => {
    try {
      // Logic
      next();
    } catch (error) {
      logger.error({ error }, 'Middleware error');
      next(error);
    }
  };
}
```

## CORS Logs

```typescript
logger.debug({ origin: 'https://example.com' }, 'CORS: Origin allowed');
logger.warn({ origin: 'https://malicious.com' }, 'CORS: Origin BLOCKED');
```

## Rate Limiting Logs

```typescript
logger.warn({ ip: '192.168.1.100', path: '/service/nodejs' }, 'Rate limit exceeded');
logger.warn({ ip: '192.168.1.100', path: '/upload' }, 'Strict rate limit exceeded');
```

## ResourceManager Logs

```typescript
logger.debug({ mode: 'github', url: 'https://...' }, 'Fetching resource from GitHub');
logger.info({ filePath: 'service/registry.json' }, 'Successfully fetched from GitHub');
logger.error({ filePath: 'missing.json', error: 'Not found' }, 'Failed to read local resource');
```

## Log Redirection

### To a File (in production)

```bash
node dist/index.js > logs/app.log 2>&1
```

### With Rotation (pino-roll)

```bash
npm install pino-roll
node dist/index.js | pino-roll -f ./logs/app.log -s 10m
```

### To an External Service

```bash
# Elasticsearch
node dist/index.js | pino-elasticsearch

# CloudWatch (AWS)
node dist/index.js | pino-cloudwatch
```

## Performance

Pino is **5x to 10x faster** than other loggers (Winston, Bunyan):
- No overhead on the main thread
- Optimized JSON serialization
- Production mode without formatting

## Filtering Sensitive Logs

To avoid logging sensitive data:

```typescript
// ❌ Bad
logger.info({ password: req.body.password }, 'User login');

// ✅ Good
logger.info({ username: req.body.username }, 'User login attempt');

// ✅ With redaction
const safeLogger = logger.child({ 
  redact: ['password', 'token', 'apiKey'] 
});
```

## Changing Log Level on the Fly

In development, you can change the level without restarting:

```typescript
// In code
logger.level = 'debug';

// Or via an admin route (careful in production!)
app.post('/admin/log-level', (req, res) => {
  logger.level = req.body.level;
  res.json({ level: logger.level });
});
```

## Best Practices

### ✅ Recommendations

1. **Use objects** for structured data
2. **Always log errors** with context
3. **Use the right level** (info for success, warn for anomalies, error for failures)
4. **Avoid logs in loops** (performance)
5. **Log important metrics** (duration, IP, status)

### ⚠️ To Avoid

1. **Don't log sensitive data** (passwords, tokens)
2. **Don't use console.log** (use logger instead)
3. **Don't log excessively** (pollutes logs)
4. **Don't log at trace/debug in production** (performance)

## Migration from console.log

```typescript
// Before
console.log('Server started on port', port);
console.error('Error:', error.message);

// After
logger.info({ port }, 'Server started');
logger.error({ error: error.message }, 'Error occurred');
```

Pino is now perfectly integrated into your API! 🎉
