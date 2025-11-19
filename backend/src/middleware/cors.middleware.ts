import cors from 'cors';
import { logger } from '../utils/logger.js';

// Create a dedicated child logger for CORS
const corsLogger = logger.child({ component: 'CORS' });

/**
 * Configure CORS middleware based on environment variables
 * 
 * @returns Configured CORS middleware
 */
export function configureCors() {
  const corsOrigins = process.env.CORS_ORIGINS || '*';
  const allowedOrigins = corsOrigins === '*' 
    ? '*' 
    : corsOrigins.split(',').map(origin => origin.trim());

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        corsLogger.debug({ origin: 'no-origin' }, 'Request with no origin - allowed');
        return callback(null, true);
      }
      
      if (allowedOrigins === '*') {
        corsLogger.debug({ origin }, 'Origin allowed (wildcard mode)');
        return callback(null, true);
      }
      
      if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
        corsLogger.debug({ origin }, 'Origin allowed');
        return callback(null, true);
      }
      
      corsLogger.warn({ origin }, 'Origin BLOCKED');
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  corsLogger.info({ allowedOrigins: allowedOrigins === '*' ? 'ALL (*)' : allowedOrigins }, 'Configuration initialized');

  return cors(corsOptions);
}
