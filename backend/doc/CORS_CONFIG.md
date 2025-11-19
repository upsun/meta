# CORS Configuration

## Overview

The Trust-API uses CORS (Cross-Origin Resource Sharing) to control which domains can access the API.

## 🔧 Configuration

### Environment Variable

In the `.env` file, define `CORS_ORIGINS`:

```env
# Allow all origins (development only)
CORS_ORIGINS=*

# Allow specific origins (recommended for production)
CORS_ORIGINS=https://example.com,https://app.example.com,http://localhost:3000

# Allow a single domain
CORS_ORIGINS=https://my-app.com
```

### Configuration Examples

#### Local Development
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000
```

#### Production
```env
CORS_ORIGINS=https://myapp.com,https://www.myapp.com,https://admin.myapp.com
```

#### Open to All (avoid in production)
```env
CORS_ORIGINS=*
```

## Allowed HTTP Methods

By default, the following methods are allowed:
- `GET`
- `POST`
- `PUT`
- `DELETE`
- `OPTIONS`

## Allowed Headers

- `Content-Type`
- `Authorization`

## Credentials

The `credentials: true` option is enabled, allowing the sending of cookies and authentication headers.

## Testing CORS

### With curl

```bash
# Simple test
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/service

# GET test
curl -H "Origin: https://example.com" \
     http://localhost:3000/service/nodejs
```

### With JavaScript (browser)

```javascript
fetch('http://localhost:3000/service/nodejs', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('CORS error:', error));
```

## CORS Error

If an origin is not allowed, you will see:

```
Error: Not allowed by CORS
```

### Solution

Add the origin to the `CORS_ORIGINS` list in your `.env` file:

```env
CORS_ORIGINS=https://example.com,https://your-new-domain.com
```

## Security

### ⚠️ Warning

**Never use `CORS_ORIGINS=*` in production!**

This allows any website to access your API, which can pose security risks.

### Best Practices

1. **Explicitly list** all allowed origins
2. **Use HTTPS** for production domains
3. **Limit** the number of origins to the strict minimum
4. **Regularly review** the list of allowed origins
