import { Request, Response } from 'express';
import { ResourceMetadata, ConditionalHeaders } from './resource.manager.js';
import crypto from 'crypto';
import { selectResponseFormat } from './response.format.js';

type EtagContext = Record<string, any>;

/**
 * Extract conditional request headers from Express request
 * @param req - Express request object
 * @returns ConditionalHeaders object with If-None-Match and If-Modified-Since if present
 */
export function extractConditionalHeaders(req: Request): ConditionalHeaders | undefined {
  const rawIfNoneMatch = req.headers['if-none-match'];
  const rawIfModifiedSince = req.headers['if-modified-since'];

  const ifNoneMatch =
    Array.isArray(rawIfNoneMatch) ? rawIfNoneMatch.join(',') : rawIfNoneMatch;
  const ifModifiedSince =
    Array.isArray(rawIfModifiedSince) ? rawIfModifiedSince[0] : rawIfModifiedSince;

  if (!ifNoneMatch && !ifModifiedSince) {
    return undefined;
  }

  return {
    ifNoneMatch,
    ifModifiedSince
  };
}

/**
 * Generate a hash from query parameters for ETag generation
 * @param queryParams - Query parameters object
 * @returns Hash string or empty if no query params
 */
function hashQueryParams(queryParams: Record<string, any>): string {
  // Filter out empty/undefined params and sort keys for consistency
  const relevantParams = Object.keys(queryParams)
    .filter(key => queryParams[key] !== undefined && queryParams[key] !== '')
    .sort()
    .reduce((acc, key) => {
      acc[key] = queryParams[key];
      return acc;
    }, {} as Record<string, any>);

  // If no params, return empty string
  if (Object.keys(relevantParams).length === 0) {
    return '';
  }

  // Generate a short hash of the query params
  const paramString = JSON.stringify(relevantParams);
  return crypto.createHash('md5').update(paramString).digest('hex').substring(0, 8);
}

/**
 * Normalize the response variant from Accept header.
 * We only vary by representation format, not the raw header value.
 */
function getAcceptVariant(req: Request | undefined): 'json' | 'yaml' {
  const rawAccept = req?.headers['accept'];
  return selectResponseFormat(rawAccept);
}

/**
 * Build ETag context that always includes negotiated representation variant.
 */
function buildEtagContext(req: Request | undefined, queryParams?: Record<string, any>): EtagContext {
  return {
    ...(queryParams || {}),
    accept: getAcceptVariant(req)
  };
}

/**
 * Generate an ETag that includes query parameters for filtered responses
 * @param baseEtag - Base ETag from the resource
 * @param queryParams - Query parameters that affect the response
 * @returns Enhanced ETag that includes query params
 */
export function generateEtagWithParams(baseEtag: string | undefined, queryParams: Record<string, any>): string | undefined {
  if (!baseEtag) {
    return undefined;
  }

  const queryHash = hashQueryParams(queryParams);

  // If no query params, return base etag as-is
  if (!queryHash) {
    return baseEtag;
  }

  // Combine base etag with query hash
  // Normalize both strong and weak ETags:
  // - Preserve an optional "W/" prefix
  // - Unwrap optional quotes around the opaque tag
  const etagMatch = baseEtag.match(/^(W\/)?\s*"?([^"]+?)"?$/);
  let prefix: string;
  let opaqueTag: string;

  if (etagMatch) {
    prefix = etagMatch[1] || '';
    opaqueTag = etagMatch[2];
  } else {
    // Fallback: previous behavior for unexpected formats
    prefix = '';
    opaqueTag = baseEtag.replace(/^"(.*)"$/, '$1');
  }

  const newOpaqueTag = `${opaqueTag}-q${queryHash}`;
  return `${prefix}"${newOpaqueTag}"`;
}

/**
 * Normalize an If-None-Match header value into a list of ETags
 * Handles string | string[] and splits on commas, trims whitespace,
 * and strips weak validators (W/ prefix).
 */
function parseIfNoneMatch(headerValue: string | string[]): string[] {
  const rawValues = Array.isArray(headerValue) ? headerValue : headerValue.split(',');

  return rawValues
    .map(value => value.trim())
    .filter(value => value.length > 0)
    .map(value => (value.startsWith('W/') ? value.substring(2).trim() : value));
}

/**
 * Check if the client's cached version matches the resource's ETag
 * @param req - Express request object
 * @param metadata - Resource metadata containing etag
 * @param queryParams - Optional query parameters that affect the response
 * @returns true if the client's cache is still valid (304 should be returned)
 */
export function checkClientCache(req: Request, metadata: ResourceMetadata, queryParams?: Record<string, any>): boolean {
  const rawClientEtag = req.headers['if-none-match'];

  if (!rawClientEtag || !metadata.etag) {
    return false;
  }

  // Generate server-side etag with query params if provided
  const etagContext = buildEtagContext(req, queryParams);
  const serverEtag = generateEtagWithParams(metadata.etag, etagContext);

  if (!serverEtag) {
    return false;
  }

  // Normalize server etag (strip weak validator if present)
  const normalizedServerEtag = serverEtag.startsWith('W/')
    ? serverEtag.substring(2).trim()
    : serverEtag;

  // Normalize client's etag(s) and check for a match
  const clientEtags = parseIfNoneMatch(rawClientEtag);
  return clientEtags.includes(normalizedServerEtag);
}

/**
 * Set cache-related headers on the response
 * @param res - Express response object
 * @param metadata - Resource metadata
 * @param maxAge - Cache max-age in seconds (default: 300 = 5 minutes)
 * @param queryParams - Optional query parameters to include in ETag
 */
export function setCacheHeaders(res: Response, metadata: ResourceMetadata, maxAge: number = 300, queryParams?: Record<string, any>): void {
  // Disable caching for now while we iterate on ETag logic and monitor cache behavior in production. We will re-enable with proper ETag handling once we are confident in the implementation.

  // // Generate ETag with request-sensitive context (Accept variant + optional query params)
  // const etagContext = buildEtagContext(res.req, queryParams);
  // const etag = generateEtagWithParams(metadata.etag, etagContext);

  // if (etag) {
  //   res.setHeader('ETag', etag);
  // }

  // if (metadata.lastModified) {
  //   res.setHeader('Last-Modified', metadata.lastModified);
  // }

  // // Set Cache-Control header
  // // - public: can be cached by browsers and CDNs
  // // - max-age: how long the cache is fresh
  // // - must-revalidate: must check with server after max-age expires
  // res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);

  // // Ensure Vary: Accept is present so caches know the response varies by Accept header
  // const existingVary = res.getHeader('Vary');
  // if (existingVary === undefined) {
  //   res.setHeader('Vary', 'Accept');
  // } else {
  //   const headerValue = Array.isArray(existingVary)
  //     ? existingVary.join(',')
  //     : String(existingVary);
  //   const varySet = new Set<string>();
  //   headerValue.split(',').forEach(value => {
  //     const trimmed = value.trim();
  //     if (trimmed) {
  //       varySet.add(trimmed);
  //     }
  //   });
  //   let hasAccept = false;
  //   for (const v of varySet) {
  //     if (v.toLowerCase() === 'accept') {
  //       hasAccept = true;
  //       break;
  //     }
  //   }
  //   if (!hasAccept) {
  //     varySet.add('Accept');
  //   }
  //   res.setHeader('Vary', Array.from(varySet).join(', '));
  // }
}

/**
 * Send a 304 Not Modified response
 * @param res - Express response object
 * @param metadata - Resource metadata (for setting etag/last-modified headers)
 * @param queryParams - Optional query parameters to include in ETag
 * @param maxAge - Cache max-age in seconds for the 304 response (default: 300 = 5 minutes)
 */
export function sendNotModified(
  res: Response,
  metadata: ResourceMetadata,
  maxAge: number = 300,
  queryParams?: Record<string, any>,
): void {
  // Generate ETag with request-sensitive context (Accept variant + optional query params)
  const etagContext = buildEtagContext(res.req, queryParams);
  const etag = generateEtagWithParams(metadata.etag, etagContext);

  if (etag) {
    res.setHeader('ETag', etag);
  }

  if (metadata.lastModified) {
    res.setHeader('Last-Modified', metadata.lastModified);
  }

  // Mirror Vary: Accept on 304 responses so caches handle negotiated variants correctly
  const existingVary = res.getHeader('Vary');
  if (existingVary === undefined) {
    res.setHeader('Vary', 'Accept');
  } else {
    const headerValue = Array.isArray(existingVary)
      ? existingVary.join(',')
      : String(existingVary);
    const varySet = new Set<string>();
    headerValue.split(',').forEach(value => {
      const trimmed = value.trim();
      if (trimmed) {
        varySet.add(trimmed);
      }
    });
    let hasAccept = false;
    for (const v of varySet) {
      if (v.toLowerCase() === 'accept') {
        hasAccept = true;
        break;
      }
    }
    if (!hasAccept) {
      varySet.add('Accept');
    }
    res.setHeader('Vary', Array.from(varySet).join(', '));
  }

  // Ensure Cache-Control is present on 304 responses so caches can correctly apply/refresh TTL
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
  }

  res.status(304).end();
}
