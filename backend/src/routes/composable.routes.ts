import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import {
  ComposableImageDto,
  ComposableImageSchemaDtoInternal,
  ComposableImageSchemaDtoPublic
} from '../schemas/composable.schema.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';

const TAG = 'Composable Image';
const PATH = '/composable';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// COMPOSABLE ROUTES
// ========================================
export const composableRouter = new ApiRouter();

// ========================================
// GET /composable - Get composable image
// ========================================
composableRouter.route({
  method: 'get',
  path: `${PATH}`,
  summary: 'Get Composable Image channels',
  description: `Returns the Composable Image configuration with all its information (name, Nix channels aka versions, etc.).`,
  tags: [TAG],
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Composable Image configuration',
      schema: ComposableImageSchemaDtoPublic,
      contentTypes: ['application/json', 'application/x-yaml'],
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      // Load composable resource
      const composableData = await resourceManager.getResource('image/composable.json');

      // Extract the "composable" object from the file
      const composableRaw = composableData.composable;

      if (!composableRaw) {
        apiLogger.error('Composable Image object not found in composable.json');
        
        return sendErrorFormatted(res, {
          title: 'Composable Image not found',
          detail: 'The "composable" object was not found in the configuration file.',
          status: 500
        });
      }

      // Validate and parse composable (depending public or internal)
      const composableParsed = req.headers.internal === 'true'
        ? ComposableImageSchemaDtoInternal.parse(composableRaw)
        : ComposableImageSchemaDtoPublic.parse(composableRaw);

      // Send formatted response
      sendFormatted<ComposableImageDto>(res, composableParsed);

    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read composable configuration');

      sendErrorFormatted(res, {
        title: 'Unable to read composable configuration',
        detail: error.message || 'An unexpected error occurred while reading composable configuration',
        status: 500
      });
    }
  }
});
