import { Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, escapeHtml, logger } from '../utils/index.js';
import { ErrorDetailsSchema, HeaderAcceptSchema } from '../schemas/api.schema.js';
import { 
  AllExtensionsSchema, 
  AllExtensions, 
  CloudExtensionsSchema, 
  CloudExtensions,
  ExtensionVersionSchema, 
  ExtensionVersion 
} from '../schemas/extension.schema.js';
import { sendFormatted, sendErrorFormatted } from '../utils/response.format.js';

extendZodWithOpenApi(z);

const apiLogger = logger.child({ component: 'API' });
const resourceManager = new ResourceManager();


export const extensionRouter = new ApiRouter();

// GET /extension/php - full YAML content
extensionRouter.route({
  method: 'get',
  path: '/extension/php',
  summary: 'Get all PHP extensions',
  description: `Returns the list of PHP extensions and their available configuration by PHP versions, grouped by "dedicated" or "cloud" services.`,
  tags: ['Extensions'],
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Full list of PHP extensions',
      schema: AllExtensionsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
    const data = await resourceManager.getResource('extension/php_extensions.json');
      sendFormatted<AllExtensions>(res, data);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PHP extensions');
      sendErrorFormatted(res, { 
        title: 'Unable to read PHP extensions', 
        detail: error.message || 'An unexpected error occurred while reading PHP extensions',
        status: 500
      });
    }
  }  
});

// GET /extension/php/cloud - grouped for cloud
extensionRouter.route({
  method: 'get',
  path: '/extension/php/cloud',
  summary: 'Get list of PHP extensions for cloud services',
  description: `Returns the list of PHP extensions for \`cloud\` service.`,
  tags: ['Extensions'],
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'List of PHP extensions for cloud services',
      schema: CloudExtensionsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const data = await resourceManager.getResource('extension/php_extensions.json');
      const cloudExtensions: CloudExtensions = data?.cloud || {};
      sendFormatted<CloudExtensions>(res, cloudExtensions);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PHP Cloud extensions');
      sendErrorFormatted(res, { 
        title: 'Unable to read PHP Cloud extensions', 
        detail: error.message || 'An unexpected error occurred while reading PHP Cloud extensions',
        status: 500
      });
    }
  } 
});

// GET /extension/php/grid/:version - grid filtered by version
extensionRouter.route({
  method: 'get',
  path: '/extension/php/cloud/:id',
  summary: 'Get Cloud extension by Id',
  description: `Get a specific Cloud extension entry by its Id from the \`cloud\` root node.`,
  tags: ['Extensions'],
  params: z.object({
    id: z.string().describe('Extension Id (e.g., json, imagick, gd)')
  }),
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Map all PHP versions allowing usage of this extension, with their status (e.g. "default", "built-in" or "available") and possible options (e.g. "wepb" for imagick)',
      schema: ExtensionVersionSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'Version not found',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const imageId = escapeHtml(id as string);
      
      const data = await resourceManager.getResource('extension/php_extensions.json');
      const extensionEntry = data?.cloud?.[imageId];

      if (!extensionEntry) {
        sendErrorFormatted(res, { 
          title: 'Extension not found', 
          detail: `Extension "${imageId}" not found. See extra.availableExtensions for a list of valid extension IDs.`,
          status: 404,
          extra: { availableExtensions: Object.keys(data?.cloud || {}) }
        });
      }
      sendFormatted<ExtensionVersion>(res, extensionEntry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PHP Cloud extensions');
      sendErrorFormatted(res, { 
        title: 'Unable to read PHP Cloud extensions', 
        detail: error.message || 'An unexpected error occurred while reading PHP Cloud extensions',
        status: 500
      });
    }
  }
});