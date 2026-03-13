# Conditional Fetch Optimization

## Problem
Previously, `getGithubResourceWithMetadata` always downloaded and parsed the full file from GitHub *before* the application could decide to return a 304 Not Modified response. This meant that even when a client had a valid cached version (sent `If-None-Match`), the server still:
1. Fetched the entire file from GitHub
2. Parsed the JSON/YAML content
3. Only then checked if the client cache was valid
4. Returned 304 (but the expensive work was already done)

This was especially costly in GitHub mode where network latency and API rate limits are concerns.

## Solution
The optimization implements **upstream conditional requests** that propagate client cache validation headers to GitHub, allowing the entire fetch/parse cycle to be skipped when content hasn't changed.

### How it Works

#### 1. Extract Conditional Headers
```typescript
const conditionalHeaders = extractConditionalHeaders(req);
// Returns: { ifNoneMatch: "etag-value", ifModifiedSince: "date" }
```

#### 2. Pass Headers to GitHub
```typescript
const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata(
  'image/registry.json', 
  conditionalHeaders
);
```

#### 3. GitHub Returns 304 (if unchanged)
When GitHub's content matches the client's cached ETag or hasn't been modified since the specified date, GitHub returns `304 Not Modified` with no body.

#### 4. Short-Circuit Response
```typescript
if (notModified) {
  return sendNotModified(res, metadata);  // No parsing, immediate 304
}
// Only reached if content changed - process data normally
```

### Request Flow

**Before (always fetches):**
```
Client → API: GET /images (If-None-Match: "abc123")
API → GitHub: GET registry.json (no conditional headers)
GitHub → API: 200 OK + 300KB JSON body
API: Parse JSON (expensive)
API: Check client ETag matches
API → Client: 304 Not Modified (but work already done!)
```

**After (conditional fetch):**
```
Client → API: GET /images (If-None-Match: "abc123")
API → GitHub: GET registry.json (If-None-Match: "abc123")
GitHub → API: 304 Not Modified (no body!)
API → Client: 304 Not Modified (skipped parsing entirely)
```

## Benefits

1. **Reduced Bandwidth**: No file download when content unchanged
2. **Faster Responses**: No JSON/YAML parsing overhead
3. **Lower GitHub API Usage**: Conditional requests don't consume as much rate limit
4. **Better Resource Utilization**: Server CPU time saved on parsing
5. **Improved Scalability**: Can handle more concurrent clients with same resources

## Implementation Details

### New Types & Interfaces

```typescript
export interface ConditionalHeaders {
  ifNoneMatch?: string;
  ifModifiedSince?: string;
}

export interface ResourceWithMetadata<T = any> {
  data: T;
  metadata: ResourceMetadata;
  notModified?: boolean; // true when upstream returns 304
}
```

### Modified Functions

#### ResourceManager
- `getResourceWithMetadata(filePath, conditionalHeaders?)` - Added optional conditional headers parameter
- `getResourceRawWithMetadata(filePath, conditionalHeaders?)` - Added optional conditional headers parameter
- `getGithubResourceWithMetadata(filePath, conditionalHeaders?)` - Now passes headers to GitHub and handles 304
- `getGithubResourceRawWithMetadata(filePath, conditionalHeaders?)` - Same for raw content

#### CacheManager
- `extractConditionalHeaders(req)` - New helper to extract `If-None-Match`/`If-Modified-Since` from Express request

### Updated Routes
All routes using `getResourceWithMetadata` or `getResourceRawWithMetadata` were updated:
- `/images` and `/images/:id`
- `/extensions/php`, `/extensions/php/cloud`, `/extensions/php/cloud/:id`
- `/regions` and `/regions/:id`
- `/composable`
- `/openapi-spec`
- `/schema/upsun`, `/schema/image-registry`, `/schema/service-versions`, `/schema/runtime-versions`

## Testing

### Manual Test
```bash
# First request - gets full content with ETag
curl -i http://localhost:3000/images

# Note the ETag from response headers:
# ETag: "1773391306186-305001"

# Second request - uses If-None-Match
curl -i -H 'If-None-Match: "1773391306186-305001"' http://localhost:3000/images

# Should return:
# HTTP/1.1 304 Not Modified
# (no body)
```

### Logs to Monitor
When GitHub mode is active, logs will show:
```
"GitHub returned 304 Not Modified - cache still valid"
```

## Configuration

The optimization is **automatic** when using GitHub-backed resources:

- **Local mode** (`RESOURCES_MODE=local`): Serves files directly from disk; conditional headers are not used and responses always include the full body
- **GitHub mode** (`RESOURCES_MODE=github`): Passes conditional headers to GitHub and returns 304 if GitHub returns 304, skipping download and parse on cache hits

No configuration changes needed - it's transparent to clients.

## Performance Impact

### Expected Improvements (GitHub mode)
- **Cache hit latency**: ~200-500ms network roundtrip (vs 1000-2000ms fetch+parse)
- **Bandwidth savings**: 100% on cache hits (no body transferred)
- **CPU usage**: Eliminates JSON/YAML parsing on cache hits
- **GitHub rate limit**: Conditional requests may have reduced impact on rate limits

### Measurement
Monitor these metrics:
1. Response time for requests with `If-None-Match` header
2. GitHub API calls per minute
3. Server CPU utilization
4. Ratio of 304 vs 200 responses

## Backward Compatibility

✅ **Fully backward compatible**
- Clients without `If-None-Match` header still get 200 responses
- Local mode continues to work as before
- No breaking changes to API responses or behavior

## Future Enhancements

Potential improvements:
1. **Client-side caching**: Include `Cache-Control: max-age=300` already set
2. **ETag with content hash**: For even better cache validation
3. **Stale-while-revalidate**: Return stale content while checking for updates in background
4. **Metrics dashboard**: Track cache hit rates and performance gains

## References

- RFC 7232: HTTP/1.1 Conditional Requests
- [GitHub ETag documentation](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#conditional-requests)
- Repository memory: `/memories/repo/caching-etag.md`
