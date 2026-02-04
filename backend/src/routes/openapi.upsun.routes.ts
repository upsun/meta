import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';

const TAG = 'OpenAPI Specification';
const PATH = '/openapi-spec';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// OPENAPI ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const openapiRouter = new ApiRouter();

// ========================================
// GET /openapi-spec - Get Upsun OpenAPI spec (JSON or YAML)
// ========================================
openapiRouter.route({
  method: 'get',
  path: `${PATH}`,
  summary: 'Get Upsun OpenAPI specification',
  description: 'Returns the Upsun OpenAPI specification file of API in JSON or YAML format.',
  tags: [TAG],
  headers: HeaderAcceptSchema,
  query: z.object({
    sdks: z.string().optional().describe('If true, returns the SDKs specific patched version')
  }),
  responses: {
    200: {
      description: 'Upsun OpenAPI specification',
      schema: z.any()
    },
    404: {
      description: 'Upsun OpenAPI spec file not found',
      schema: ErrorDetailsSchema
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      // Detect requested format
      const acceptHeader = (req.headers.accept || '').toLowerCase();
      const sdks = req.query.sdks === 'true';

      let format: 'json' | 'yaml' = 'json';
      if (acceptHeader.includes('yaml')) {
        format = 'yaml';
      }
      let fileName;
      if (sdks) {
        fileName = 'openapispec-upsun-sdks.json';
      } else {
        fileName = format === 'yaml' ? 'openapispec-upsun.yaml' : 'openapispec-upsun.json';
      }
      try {
        // serving the raw file according to the format
        const data = await resourceManager.getResourceRaw(`openapi/${fileName}`);
        if (format === 'yaml' && !sdks) {
          res.type('text/plain; charset=utf-8').send(data);
        } else {
          res.type('application/json').send(data);
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
