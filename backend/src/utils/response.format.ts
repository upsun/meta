import { Response } from 'express';
import YAML from "yaml";

/**
 * Send response in JSON (default) or YAML if requested by Accept header.
 * @param res Express response
 * @param data Data to send
 * @param status HTTP status code (default 200)
 */
export function sendFormatted<T>(res: Response, data: T, status = 200) {
  const accept = res.req?.headers['accept'] || '';
  if (accept.includes('application/x-yaml')) {
    res.set('Content-Type', 'text/plain; charset=utf-8'); // otherwise, YAML is downloaded as binary and is not displayed in the test request interface
    res.status(status).send(YAML.stringify(data));
  } else {
    res.set('Content-Type', 'application/json');
    res.status(status).json(data);
  }
}

export function sendErrorFormatted(res: Response, error: { type?: string; title?: string; status?: number; detail?: any; instance?: string; extra?: Record<string, any>;}, status?: number) {
  const accept = res.req?.headers['accept'] || '';
  if (accept.includes('application/x-yaml')) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(status || error.status || 500).send(YAML.stringify(error));
  } else {
    res.set('Content-Type', 'application/json');
    res.status(status || error.status || 500).json({ ...error });
  }
}
