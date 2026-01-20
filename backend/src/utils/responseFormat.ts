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
    data;
    res.status(status).send(YAML.stringify(data));
  } else {
    res.set('Content-Type', 'application/json');
    res.status(status).json(data);
  }
}
