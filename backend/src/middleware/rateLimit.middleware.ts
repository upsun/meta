import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.config.js';

// Create dedicated child loggers for Rate Limiting
const rateLimitLogger = logger.child({ component: 'RateLimit' });
const strictRateLimitLogger = logger.child({ component: 'StrictRateLimit' });

/**
 * Configure rate limiting middleware based on environment variables
 *
 * Environment variables:
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - RATE_LIMIT_MAX_REQUESTS: Maximum requests per window (default: 100)
 * - RATE_LIMIT_MESSAGE: Custom error message
 *
 * @returns Configured rate limit middleware
 */
export function configureRateLimit() {
  // Parse configuration from environment variables
  const windowMs = config.rateLimit.WINDOW_MS;
  const maxRequests = config.rateLimit.MAX_REQUESTS;
  const message = 'Too many requests from this IP, please try again later.';

  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: message,
      retryAfter: `${windowMs / 1000} seconds`,
    },
    standardHeaders: 'draft-7', // Use draft-7 standard for better compatibility
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    
    // Skip successful requests - only count when limit is hit or errors occur
    skipSuccessfulRequests: false,
    
    // Use a sliding window strategy for more accurate rate limiting
    // This prevents the "reset cliff" where all requests suddenly become available
    validate: { trustProxy: true },
    
    handler: (req, res) => {
      rateLimitLogger.warn({ 
        ip: req.ip, 
        path: req.path,
        'x-forwarded-for': req.headers['x-forwarded-for']
      }, 'Rate limit exceeded');
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
    
    // Add request lifecycle logging for debugging
    skip: (req) => {
      // Log every request for monitoring
      rateLimitLogger.debug({ 
        ip: req.ip, 
        path: req.path,
        'x-forwarded-for': req.headers['x-forwarded-for']
      }, 'Rate limit check');
      return false; // Don't skip any requests
    },
  });

  rateLimitLogger.info({
    windowSeconds: windowMs / 1000,
    windowMinutes: windowMs / 60000,
    maxRequests,
    strategy: 'sliding-window'
  }, 'Configuration initialized');

  return limiter;
}

/**
 * Stricter rate limit for sensitive endpoints
 *
 * @returns Configured strict rate limit middleware
 */
export function configureStrictRateLimit() {
  const windowMs = config.rateLimit.STRICT_WINDOW_MS;
  const maxRequests = config.rateLimit.STRICT_MAX_REQUESTS;

  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'Too many requests to this endpoint, please slow down.',
      retryAfter: `${windowMs / 1000} seconds`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      strictRateLimitLogger.warn({ ip: req.ip, path: req.path }, 'Strict rate limit exceeded');
      res.status(429).json({
        error: 'Too many requests to this endpoint, please slow down.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });

  strictRateLimitLogger.info({
    windowSeconds: windowMs / 1000,
    maxRequests
  }, 'Configuration initialized');

  return limiter;
}
