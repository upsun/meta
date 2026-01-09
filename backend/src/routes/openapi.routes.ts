import { Request, Response } from 'express';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';


const apiLogger = logger.child({ component: 'API' });
export const openapiRouter = new ApiRouter();


// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// GET /openapi-spec - Get Upsun OpenAPI spec (JSON or YAML)
// ========================================
import { z } from 'zod';

openapiRouter.route({
  method: 'get',
  path: '/openapi-spec',
  summary: 'Get Upsun OpenAPI specification',
  description: 'Returns the Upsun OpenAPI specification file of API in JSON or YAML format.',
  tags: ['OpenAPI'],
  query: z.object({
    format: z.enum(['json', 'yaml']).optional().describe('Format of the spec file (json or yaml)'),
    sdks: z.string().optional().describe('If true, returns the SDKs specific patched version')
  }),
  responses: {
    200: {
      description: 'Upsun OpenAPI specification',
      schema: z.any()
    },
    404: {
      description: 'Upsun OpenAPI spec file not found',
      schema: z.object({ error: z.string() })
    },
    500: {
      description: 'Internal server error',
      schema: z.object({ error: z.string() })
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as string)?.toLowerCase() || 'json';
      const sdks = req.query.sdks === 'true';
      let fileName;
      if (sdks) {
        fileName = 'openapispec-upsun-sdks.json';
      } else {
        fileName = format === 'yaml' ? 'openapispec-upsun.yaml' : 'openapispec-upsun.json';
      }
      try {
        const data = await resourceManager.getResource(`openapi/${fileName}`);
        if (format === 'yaml' && !sdks) {
          res.type('yaml').send(data);
        } else {
          res.type('json').send(data);
        }
      } catch (err: any) {
        apiLogger.error({ error: err.message }, 'Spec file not found');
        res.status(404).json({ error: 'Spec file not found' });
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read Upsun OpenAPI spec');
      res.status(500).json({ error: error.message || 'Unable to read Upsun OpenAPI spec' });
    }
  }
});
