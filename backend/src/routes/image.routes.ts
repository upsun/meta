import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { withSelfLink } from '../utils/api.schema.js';
import { ResourceManager, escapeHtml, logger } from '../utils/index.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import {
  ImageListRegistry,
  ImageListSchema,
  ImageRegistry,
  ImageSchema
} from '../schemas/image.schema.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';

const TAG = 'Images';
const PATH = '/images';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// IMAGE ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const imageRouter = new ApiRouter();

// ========================================
// GET /images - Get all images
// ========================================
imageRouter.route({
  method: 'get',
  path: `${PATH}`,
  summary: 'Get all images',
  description: `Returns the complete list of available images with all their information (name, endpoint, versions, etc.).`,
  tags: [TAG],
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Complete image registry',
      schema: ImageListSchema,
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
      const registry = await resourceManager.getResource('image/registry.json');
      const registryParsed = ImageListSchema.parse(registry);
      const baseUrl = `${config.server.BASE_URL}`;
      const registryWithLinks = withSelfLink(registryParsed, (id) => `${baseUrl}${PATH}/${encodeURIComponent(id)}`);

      sendFormatted<ImageListRegistry>(res, registryWithLinks);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry');
      sendErrorFormatted(res, { 
        title: 'Unable to read registry', 
        detail: error.message || 'An unexpected error occurred while reading PHP Cloud extensions',
        status: 500
      });
    }
  }
});

// ========================================
// GET /images/:id - Get image by id
// ========================================
imageRouter.route({
  method: 'get',
  path: `${PATH}/:id`,
  summary: 'Get image by Id',
  description: `Returns information for a specific image.`,
  tags: [TAG],
  params: z.object({
    id: z.string().describe('Image Id (e.g., nodejs, php, chrome-headless)')
  }),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Image found and returned',
      schema: ImageSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    400: {
      description: 'Invalid query parameter',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'Image not found',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const imageId = escapeHtml(id);

      // Get registry
      const registry = await resourceManager.getResource('image/registry.json');

      // Check if image exists
      if (!registry[id]) {
        const availableImages = Object.keys(registry);
        apiLogger.warn({ image: imageId }, 'Image not found');

        return sendErrorFormatted(res, { 
          title: 'Image not found', 
          detail: `Image '${imageId}' not found in the existing images. See extra.availableImages for a list of valid image IDs.`,
          status: 404,
          extra: { availableImages }
        });
      }

      const imageData = registry[id];

      const imageDataParsed = ImageSchema.safeParse(imageData);
      if (imageDataParsed.success) {
        sendFormatted<ImageRegistry>(res, imageDataParsed.data);
      } else {
        let error = imageDataParsed.error;
        // If error is a stringified JSON, parse it
        let errorObj;
        try {
          errorObj = typeof error === "string" ? JSON.parse(error) : error;
        } catch {
          errorObj = error;
        }
        sendErrorFormatted(res, { 
          title: 'An error occured', 
          detail: errorObj.message || 'An unexpected error occurred while parsing image data',
          status: 400
        });
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry');
      sendErrorFormatted(res, { 
        title: 'An error occured', 
        detail: error.message || 'Unable to read registry',
        status: 500
      });
    }
  }
});

