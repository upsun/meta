import pino from 'pino';
import { config } from '../config/env.config.js';

/**
 * Configure Pino logger based on environment
 * 
 * Environment variables:
 * - LOG_LEVEL: Logging level (default: info)
 * - NODE_ENV: Environment (development/production)
 * 
 * @returns Configured Pino logger instance
 */
export function configureLogger() {
  const isDevelopment = config.isDevelopment();
  const logLevel = config.logging.LOG_LEVEL;

  const logger = pino({
    level: logLevel,
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
            messageFormat: '{component} {msg}',
          },
        }
      : undefined,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  logger.info({ component: 'Logger' }, `Initialized in ${isDevelopment ? 'development' : 'production'} mode`);
  logger.info({ component: 'Logger' }, `Log level: ${logLevel}`);

  return logger;
}

// Create a singleton logger instance
export const logger = configureLogger();
