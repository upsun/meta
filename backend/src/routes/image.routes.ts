import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { withSelfLink } from '../utils/api.schema.js';
import { ResourceManager, escapeHtml, logger, extractConditionalHeaders, setCacheHeaders, sendNotModified } from '../utils/index.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import {
  DeployImageListDto,
  DeployImageListSchemaDtoInternal,
  DeployImageListSchemaDtoPublic,
  DeployImageDto,
  DeployImageSchemaDtoInternal,
  DeployImageSchemaDtoPublic
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
      schema: DeployImageListSchemaDtoPublic,
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
      // Load registry from resources with metadata, supporting conditional requests
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data: registryRaw, metadata, notModified } = await resourceManager.getResourceWithMetadata('image/registry.json', conditionalHeaders);

      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }

      // Add self links to each image in the registry
      const registryLink = withSelfLink(registryRaw, (id) => `${config.server.BASE_URL}${PATH}/${encodeURIComponent(id)}`);

      // Validate and parse registry (depending public or internal)
      const registryParsed = req.headers.internal === 'true'
        ? DeployImageListSchemaDtoInternal.parse(registryLink)
        : DeployImageListSchemaDtoPublic.parse(registryLink);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      // Send formatted response
      sendFormatted<DeployImageListDto>(res, registryParsed);

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
      schema: DeployImageSchemaDtoPublic,
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

      // Load registry from resources with metadata, supporting conditional requests
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data: registryRaw, metadata, notModified } = await resourceManager.getResourceWithMetadata('image/registry.json', conditionalHeaders);

      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata);
      }

      // Check if image exists
      if (!registryRaw[id]) {
        const availableImages = Object.keys(registryRaw);
        apiLogger.warn({ image: imageId }, 'Image not found');

        return sendErrorFormatted(res, {
          title: 'Image not found',
          detail: `Image '${imageId}' not found in the existing images. See extra.availableImages for a list of valid image IDs.`,
          status: 404,
          extra: { availableImages }
        });
      }
      const imageRaw = registryRaw[id];

      // Validate and parse registry (depending public or internal)
      const imageParsed = req.headers.internal === 'true'
        ? DeployImageSchemaDtoInternal.parse(imageRaw)
        : DeployImageSchemaDtoPublic.parse(imageRaw);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      // Send formatted response
      sendFormatted<DeployImageDto>(res, imageParsed);

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

