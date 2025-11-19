import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Create a dedicated child logger for HTTP requests
const requestLogger = logger.child({ component: 'HTTP' });

/**
 * HTTP request logging middleware using Pino
 * Logs all incoming requests and their responses
 */
export function httpLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log incoming request
    requestLogger.info({
      type: 'request',
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, `→ ${req.method} ${req.url}`);

    // Capture the original end function
    const originalEnd = res.end;

    // Override res.end to log response
    res.end = function (chunk?: any, encoding?: any, callback?: any): any {
      const duration = Date.now() - startTime;

      // Log response
      requestLogger.info({
        type: 'response',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      }, `← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);

      // Call the original end function
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}
