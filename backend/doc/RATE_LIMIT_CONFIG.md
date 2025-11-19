# Rate Limiting Configuration

## Overview

The Trust-API uses rate limiting to protect against abuse and denial of service (DoS) attacks.

## Configuration

### Environment Variables

In the `.env` file, configure the rate limits:

```env
# General Rate Limiting (applied to all endpoints)
RATE_LIMIT_WINDOW_MS=900000          # Time window in ms (15 minutes by default)
RATE_LIMIT_MAX_REQUESTS=100          # Max number of requests per window
RATE_LIMIT_MESSAGE=Too many requests from this IP, please try again later.

# Strict Rate Limiting (for sensitive endpoints)
STRICT_RATE_LIMIT_WINDOW_MS=60000    # 1 minute
STRICT_RATE_LIMIT_MAX_REQUESTS=10    # 10 max requests
```

### Configuration Examples

#### Development (Soft Limits)
```env
RATE_LIMIT_WINDOW_MS=60000           # 1 minute
RATE_LIMIT_MAX_REQUESTS=1000         # 1000 requests
```

#### Production (Normal Limits)
```env
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # 100 requests
```

#### Strict Production (Public API)
```env
RATE_LIMIT_WINDOW_MS=300000          # 5 minutes
RATE_LIMIT_MAX_REQUESTS=50           # 50 requests
```

## Types of Rate Limiting

### 1. General Rate Limit
Automatically applied to **all API endpoints**.

**Default configuration:**
- Window: 15 minutes
- Maximum: 100 requests per IP

### 2. Strict Rate Limit
For specific endpoints requiring enhanced protection.

**Default configuration:**
- Window: 1 minute
- Maximum: 10 requests per IP

**Usage in code:**
```typescript
import { configureStrictRateLimit } from './middleware/rateLimit.middleware';

// Apply to a specific endpoint
app.post('/sensitive-endpoint', configureStrictRateLimit(), (req, res) => {
  // Handler
});
```

## Response Headers

When a request is made, the following headers are included:

```
RateLimit-Limit: 100              # Max number of requests
RateLimit-Remaining: 95           # Remaining requests
RateLimit-Reset: 1234567890       # Reset timestamp
```

## Response on Limit Exceeded

### HTTP Status
```
429 Too Many Requests
```

### Response Body
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

### Headers
```
Retry-After: 900                  # Seconds to wait
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1234567890
```

## Time Conversion

| Value (ms) | Equivalent |
|------------|------------|
| 60000      | 1 minute   |
| 300000     | 5 minutes  |
| 600000     | 10 minutes |
| 900000     | 15 minutes |
| 3600000    | 1 hour     |

## Calculation Formula

```
windowMs = minutes × 60 × 1000
```

Example: 15 minutes = 15 × 60 × 1000 = 900000 ms

## Testing Rate Limiting

### With curl

```bash
# Make multiple requests quickly
for i in {1..101}; do
  curl http://localhost:3000/service/nodejs
  echo "Request $i"
done
```

### With JavaScript

```javascript
// Test rate limit
async function testRateLimit() {
  for (let i = 0; i < 101; i++) {
    const response = await fetch('http://localhost:3000/service/nodejs');
    console.log(`Request ${i + 1}: ${response.status}`);
    
    if (response.status === 429) {
      const data = await response.json();
      console.log('Rate limited!', data);
      break;
    }
  }
}

testRateLimit();
```

## Logs

The middleware generates logs when a rate limit is triggered:

```
[RATE LIMIT] Configuration initialized
[RATE LIMIT] Window: 900 seconds (15 minutes)
[RATE LIMIT] Max requests: 100
[RATE LIMIT] IP 192.168.1.100 exceeded rate limit
```

## Best Practices

### ✅ Recommendations

1. **Adapt limits** according to your expected traffic
2. **Use strict limits** for sensitive endpoints (auth, upload, etc.)
3. **Monitor logs** to detect abuse
4. **Inform users** via API documentation

### ⚠️ To Avoid

1. **Don't disable** rate limiting in production
2. **Don't set limits too low** (risk of blocking legitimate users)
3. **Don't use the same limit** for all endpoints

## Configuration Examples by API Type

### Public API (Read-only)
```env
RATE_LIMIT_WINDOW_MS=300000          # 5 minutes
RATE_LIMIT_MAX_REQUESTS=50
```

### Private API (With Authentication)
```env
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=200
```

### Development API (Local)
```env
RATE_LIMIT_WINDOW_MS=60000           # 1 minute
RATE_LIMIT_MAX_REQUESTS=1000         # Very permissive
```

## Bypassing Rate Limiting

To bypass rate limiting (not recommended in production), comment out the line in `index.ts`:

```typescript
// app.use(configureRateLimit());  // Rate limiting disabled
```

Or configure very high limits:

```env
RATE_LIMIT_MAX_REQUESTS=999999
```
