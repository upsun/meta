import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import { ErrorDetailsSchema } from '../schemas/api.schema.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import { Validation, ValidationSchema } from '../schemas/validation.schema.js';

const TAG = 'Validation Schema';
const PATH = '/schema';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// Simple semver comparison (numeric segments, no pre-release handling)
const compareSemver = (a: string, b: string): number => {
  const as = a.split('.').map((n) => parseInt(n, 10));
  const bs = b.split('.').map((n) => parseInt(n, 10));
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const av = as[i] ?? 0;
    const bv = bs[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};

// ========================================
// VALIDATION ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const validationRouter = new ApiRouter();

// ========================================
// GET /schema/config - Get Upsun validation schema
// ========================================
validationRouter.route({
  method: 'get',
  path: `${PATH}/config`,
  summary: 'Get Upsun validation JSON schema',
  description: `
Returns the Upsun validation JSON schema file used by the validator.
This file is used to validate Upsun configuration files .upsun/config.yaml.
  `,
  tags: [TAG],
  responses: {
    200: {
      description: 'Upsun validation JSON schema',
      schema: ValidationSchema
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const schema = await resourceManager.getResource('validation/upsun.json');
      sendFormatted<Validation>(res, schema);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read Upsun validation schema');
      sendErrorFormatted(res, {
        title: 'Unable to read Upsun validation schema',
        detail: error.message || 'An unexpected error occurred while reading Upsun validation schema',
        status: 500
      });
    }
  }
});

// ========================================
// GET /schema/image - Get image registry validation schema
// ========================================
validationRouter.route({
  method: 'get',
  path: `${PATH}/image-registry`,
  summary: 'Get Registry validation JSON schema',
  description: `Returns the JSON Schema used to validate the image registry file.`,
  tags: [TAG],
  responses: {
    200: {
      description: 'Image registry JSON Schema',
      schema: z.any()
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const schema = await resourceManager.getResource('image/registry.schema.json');
      sendFormatted(res, schema);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read image registry validation schema');
      sendErrorFormatted(res, {
        title: 'Unable to read image registry validation schema',
        detail: error.message || 'An unexpected error occurred while reading image registry validation schema',
        status: 500
      });
    }
  }
});

// ========================================
// GET /schema/service-versions - Get service versions list
// ========================================
validationRouter.route({
  method: 'get',
  path: `${PATH}/service-versions`,
  'x-internal': true,
  summary: 'Get enum of service versions included in validation schema',
  description: `
Returns the enum list of all service images and
their possible versions, derived from \`/image\` and this is called from the upsun.json validation schema ("service.type" param).

The result is a JSON Schema snippet:

\`\`\`json
{
  "type": "string",
  "enum": ["chrome-headless:120", "redis:7", ...]
}
\`\`\`
  `,
  tags: [TAG],
  responses: {
    200: {
      description: 'JSON Schema enum for service versions',
      schema: z.object({
        type: z.literal('string'),
        enum: z.array(z.string())
      })
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const registry = await resourceManager.getResource('image/registry.json');

      const serviceSet = new Set<string>();

      Object.entries(registry).forEach(([key, value]: [string, any]) => {
        if (!value || value.runtime) {
          return;
        }

        const versions = Array.isArray((value as any).versions) ? (value as any).versions : [];

        versions.forEach((v: any) => {
          if (!v || typeof v.name !== 'string' || !v.name) {
            return;
          }

          // Normalize version similar to runtime versions
          const normalizedVersion = v.name.split(' ')[0];
          serviceSet.add(`${key}:${normalizedVersion}`);
        });
      });

      const services = Array.from(serviceSet).sort((a, b) => {
        const [nameA, verA] = a.split(':');
        const [nameB, verB] = b.split(':');

        // Alphabetical order by service name
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;

        // Same service: descending semver order
        return compareSemver(verB, verA);
      });

      res.json({
        type: 'string',
        enum: services
      });
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to build service versions list');
      res.status(500).json({ error: error.message || 'Unable to build service versions list' });
    }
  }
});

// ========================================
// GET /schema/runtime-versions - Get runtime versions list
// ========================================
validationRouter.route({
  method: 'get',
  path: `${PATH}/runtime-versions`,
  'x-internal': true,
  summary: 'Get enum of runtime versions included in validation schema',
  description: `
Returns the enum list of all runtime images and
their possible versions, derived from \`/image\` and this is called from the upsun.json runtime.type param.

The result is an array of strings formatted as \`"<imageKey>:<version>"\`,
for example: \`["php:7.2", "php:7.3", "nodejs:24"]\`.
  `,
  tags: [TAG],
  responses: {
    200: {
      description: 'JSON Schema enum for runtime versions',
      schema: z.object({
        type: z.literal('string'),
        enum: z.array(z.string())
      })
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const registry = await resourceManager.getResource('image/registry.json');

      const runtimeSet = new Set<string>();

      Object.entries(registry).forEach(([key, value]: [string, any]) => {
        if (!value || !value.runtime) {
          return;
        }

        const versions = Array.isArray((value as any).versions) ? (value as any).versions : [];

        versions.forEach((v: any) => {
          if (!v || typeof v.name !== 'string' || !v.name) {
            return;
          }

          // Normalize version: keep the numeric part before any space
          // e.g. "8.0 (LTS)" -> "8.0"
          const normalizedVersion = v.name.split(' ')[0];
          runtimeSet.add(`${key}:${normalizedVersion}`);
        });
      });

      const runtimes = Array.from(runtimeSet).sort((a, b) => {
        const [nameA, verA] = a.split(':');
        const [nameB, verB] = b.split(':');

        // Alphabetical order by runtime name
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;

        // Same runtime: descending semver order
        return compareSemver(verB, verA);
      });

      // Return a JSON Schema snippet suitable for use as:
      // { "runtime-version": { "$ref": "https://example.com/schema/runtime-versions.json" } }
      res.json({
        type: 'string',
        enum: runtimes
      });
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to build runtime versions list');
      res.status(500).json({ error: error.message || 'Unable to build runtime versions list' });
    }
  }
});
