import { Response } from 'express';
import YAML from "yaml";

export function selectResponseFormat(acceptHeader: string | string[] | undefined): 'json' | 'yaml' {
  const raw = Array.isArray(acceptHeader) ? acceptHeader.join(',') : (acceptHeader || '');
  const normalized = raw.toLowerCase().trim();

  if (!normalized) {
    return 'json';
  }

  const items = normalized.split(',').map((entry, index) => {
    const [typePart, ...params] = entry.split(';').map((v) => v.trim());
    let q = 1;
    let hasQ = false;
    for (const param of params) {
      if (param.startsWith('q=')) {
        hasQ = true;
        const parsed = Number(param.slice(2));
        if (!Number.isNaN(parsed)) {
          q = parsed;
        }
      }
    }
    return { type: typePart, q, index, hasQ };
  });

  const explicitTypes = items
    .map((m) => {
      if (m.type === 'application/json') {
        return { ...m, format: 'json' as const };
      }
      if (m.type === 'application/x-yaml' || m.type === 'text/yaml') {
        return { ...m, format: 'yaml' as const };
      }
      return null;
    })
    .filter((m): m is { type: string; q: number; index: number; hasQ: boolean; format: 'json' | 'yaml' } => m !== null);

  const jsonCandidates = items.filter((m) => m.type === 'application/json' || m.type === 'application/*' || m.type === '*/*');
  const yamlCandidates = items.filter((m) => m.type === 'application/x-yaml' || m.type === 'text/yaml');

  if (yamlCandidates.length === 0) {
    return 'json';
  }

  const hasAnyQ = items.some((m) => m.hasQ);

  // Scalar can send merged/duplicated Accept values.
  // Without q-values, treat a simple "json,yaml" pair as default JSON;
  // otherwise pick the last explicit media type to respect user selection.
  if (!hasAnyQ && explicitTypes.length > 0) {
    const jsonCount = explicitTypes.filter((m) => m.format === 'json').length;
    const yamlCount = explicitTypes.filter((m) => m.format === 'yaml').length;

    if (jsonCount === 1 && yamlCount === 1 && explicitTypes.length === 2) {
      return 'json';
    }

    return explicitTypes[explicitTypes.length - 1].format;
  }

  const bestJson = jsonCandidates.reduce<{ q: number; index: number } | null>((best, current) => {
    if (!best || current.q > best.q || (current.q === best.q && current.index < best.index)) {
      return { q: current.q, index: current.index };
    }
    return best;
  }, null);

  const bestYaml = yamlCandidates.reduce<{ q: number; index: number } | null>((best, current) => {
    if (!best || current.q > best.q || (current.q === best.q && current.index < best.index)) {
      return { q: current.q, index: current.index };
    }
    return best;
  }, null);

  if (!bestYaml) {
    return 'json';
  }

  if (!bestJson) {
    return bestYaml.q > 0 ? 'yaml' : 'json';
  }

  if (bestYaml.q > bestJson.q) {
    return 'yaml';
  }

  if (bestYaml.q === bestJson.q && bestYaml.index > bestJson.index) {
    return 'yaml';
  }

  return 'json';
}

/**
 * Send response in JSON (default) or YAML if requested by Accept header.
 * @param res Express response
 * @param data Data to send
 * @param status HTTP status code (default 200)
 */
export function sendFormatted<T>(res: Response, data: T, status = 200) {
  const format = selectResponseFormat(res.req?.headers['accept']);
  if (format === 'yaml') {
    res.set('Content-Type', 'text/plain; charset=utf-8'); // otherwise, YAML is downloaded as binary and is not displayed in the test request interface
    res.status(status).send(YAML.stringify(data));
  } else {
    res.set('Content-Type', 'application/json');
    res.status(status).json(data);
  }
}

export function sendErrorFormatted(res: Response, error: { type?: string; title?: string; status?: number; detail?: string; instance?: string; extra?: Record<string, any>;}, status?: number) {
  const format = selectResponseFormat(res.req?.headers['accept']);
  if (format === 'yaml') {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(status || error.status || 500).send(YAML.stringify(error));
  } else {
    res.set('Content-Type', 'application/json');
    res.status(status || error.status || 500).json({ ...error });
  }
}
