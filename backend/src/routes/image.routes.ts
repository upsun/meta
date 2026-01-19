import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import { sendFormatted } from '../utils/responseFormat.js';
import {
  ImagesRegistry,
  ImagesSchema,
  ImageRegistry,
  ImageSchema,
  ErrorSchema
} from '../schemas/image.schema.js';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// IMAGE ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const imageRouter = new ApiRouter();

// ========================================
// GET /image - Get all images
// ========================================
imageRouter.route({
  method: 'get',
  path: '/image',
  summary: 'Get all images',
  description: `Returns the complete list of available images with all their information (name, endpoint, versions, etc.).

  **Supported formats:**
  - \`application/json\` (default)
  - \`application/x-yaml\`

  Use the \`Accept\` header to specify your preferred format.`,
  tags: ['Images'],
  
  responses: {
    200: {
      description: 'Complete image registry',
      schema: ImagesSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
    },
    500: {
      description: 'Internal server error',
      schema: ErrorSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const registry = await resourceManager.getResource('image/registry.json');
      sendFormatted<ImagesRegistry>(res, registry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry');
      sendFormatted<ImagesRegistry>(res, { error: error.message || 'Unable to read registry' }, 500);
    }
  }
});

// ========================================
// GET /image/:name - Get image by name
// ========================================
imageRouter.route({
  method: 'get',
  path: '/image/:id',
  summary: 'Get image by Id',
  description: `Returns information for a specific image.

  **Supported formats:**
  - \`application/json\` (default)
  - \`application/x-yaml\`

  Use the \`Accept\` header to specify your preferred format.`,
    
  tags: ['Images'],
  params: z.object({
    id: z.string().describe('Image Id (e.g., nodejs, php, chrome-headless)')
  }),
  responses: {
    200: {
      description: 'Image found and returned',
      schema: ImageSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    400: {
      description: 'Invalid query parameter',
      schema: ErrorSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'Image not found',
      schema: ErrorSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get registry
      const registry = await resourceManager.getResource('image/registry.json');

      // Check if image exists
      if (!registry[id]) {
        const availableImages = Object.keys(registry);
        apiLogger.warn({ image: id }, 'Image not found');

        return sendFormatted(res, {
          error: `Image '${id}' not found`,
          availableImages
        }, 404);
      }

      const imageData = registry[id];

      const imageDataParsed = ImageSchema.safeParse(imageData);
      if (imageDataParsed.success) {
        sendFormatted<ImageRegistry>(res, imageDataParsed.data);
      } else {
        let error = imageDataParsed.error;
        // Si error est une string JSON, on la parse
        let errorObj;
        try {
          errorObj = typeof error === "string" ? JSON.parse(error) : error;
        } catch {
          errorObj = error;
        }
        sendFormatted(res, { error: errorObj }, 400);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry file');
      sendFormatted(res, { error: error.message || 'Unable to read registry file' }, 500);
    }
  }
});

