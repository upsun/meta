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
export function configureCors() {
  const corsOrigins = config.cors.ORIGINS;
  const allowedOrigins = corsOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  const sanitizedOrigins = Array.from(new Set(allowedOrigins.filter(origin => origin !== '*')));

  if (allowedOrigins.includes('*')) {
    corsLogger.warn('Wildcard origins are ignored in production, define explicit domains in CORS_ORIGINS');
  }

  if (sanitizedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must define at least one explicit origin');
  }

  const originSet = new Set(sanitizedOrigins);

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (CLI tools, Postman, mobile apps)
      if (!origin) {
        corsLogger.debug({ origin: 'no-origin' }, 'Request with no origin - allowed');
        return callback(null, true);
      }

      if (originSet.has(origin)) {
        corsLogger.debug({ origin }, 'Origin allowed');
        return callback(null, true);
      }

      corsLogger.warn({ origin }, 'Origin BLOCKED');
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
