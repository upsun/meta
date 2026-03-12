import cors from 'cors';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.config.js';

// Create a dedicated child logger for CORS
const corsLogger = logger.child({ component: 'CORS' });

/**
 * Configure CORS middleware based on environment variables
 *
 * @returns Configured CORS middleware
 */
/**
 * Check if origin matches any of the allowed patterns
 * Supports exact matches and wildcard patterns (e.g., https://*.example.com)
 */
function isOriginAllowed(origin: string, allowedPatterns: string[]): boolean {
  for (const pattern of allowedPatterns) {
    // Exact match
    if (pattern === origin) {
      return true;
    }

    // Wildcard pattern support (e.g., https://*.mintlify.app)
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // Escape dots
        .replace(/\*/g, '.*');  // Replace * with .*
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(origin)) {
        return true;
      }
    }
  }
  return false;
}

export function configureCors() {
  const corsOrigins = config.cors.ORIGINS;
  const allowedOrigins = corsOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  const sanitizedOrigins = [...new Set(allowedOrigins.filter(origin => origin !== '*'))];

  if (allowedOrigins.includes('*')) {
    corsLogger.warn('Wildcard origins are ignored in production, define explicit domains in CORS_ORIGINS');
  }

  if (sanitizedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must define at least one explicit origin. Configure it in your .env file (e.g., CORS_ORIGINS=https://example.com)');
  }

  corsLogger.info({ allowedOrigins: sanitizedOrigins }, 'CORS patterns configured');

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (CLI tools, Postman, mobile apps)
      if (!origin) {
        corsLogger.debug({ origin: 'no-origin' }, 'Request with no origin - allowed');
        return callback(null, true);
      }

      if (isOriginAllowed(origin, sanitizedOrigins)) {
        corsLogger.debug({ origin }, 'Origin allowed');
        return callback(null, true);
      }

      corsLogger.warn({ origin, allowedPatterns: sanitizedOrigins }, 'Origin BLOCKED');
      callback(new Error('Not allowed by CORS'));
    },
    // Credentials are disabled to avoid reflecting sensitive cookies back to untrusted origins
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  corsLogger.info({ allowedOrigins: sanitizedOrigins }, 'Configuration initialized');

  return cors(corsOptions);
}
