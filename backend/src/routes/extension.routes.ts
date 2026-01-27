import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { registry, z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, escapeHtml, logger } from '../utils/index.js';
import { ErrorDetailsSchema, HeaderAcceptSchema } from '../schemas/api.schema.js';
import {
  RuntimeExtensionListSchema,
  RuntimeExtensionList,
  CloudExtensionsSchema,
  CloudExtensions,
  RuntimeExtensionVersionSchema,
  RuntimeExtensionVersion
} from '../schemas/extension.schema.js';
import { sendFormatted, sendErrorFormatted } from '../utils/response.format.js';
import { withSelfLink } from '../utils/api.schema.js';

extendZodWithOpenApi(z);

const apiLogger = logger.child({ component: 'API' });
const resourceManager = new ResourceManager();

const PATH = '/extension/php';
const TAG = 'Extensions';


export const extensionRouter = new ApiRouter();

// GET /extension/php - full YAML content
extensionRouter.route({
  method: 'get',
  path: `${PATH}`,
  summary: 'Get all PHP extensions',
  description: `Returns the list of PHP extensions and their available configuration by PHP versions, grouped by "dedicated" or "cloud" services.`,
  tags: [TAG],
  query: z.object({
    service: z.enum(['all', 'cloud', 'dedicated'])
      .optional()
      .describe('Filter by service name (e.g., "dedicated", "cloud")'),
  }),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Full list of PHP extensions with optional filtering by service',
      schema: RuntimeExtensionListSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { service } = req.query as {
        service?: 'all' | 'cloud' | 'dedicated';
      };
      const safeService = service ? escapeHtml(service) : undefined;

      let data = await resourceManager.getResource('extension/php_extensions.json');
      
      if (service && service !== 'all') {
        let dataFiltered = {};
        dataFiltered = { [service]: data?.[service] };
        if (Object.keys(dataFiltered).length === 0) {      
          return sendErrorFormatted(res, {
            title: `No extensions found for service '${safeService}'`,
            detail: `No extensions found for service '${safeService}', "service" should be one of "dedicated" or "cloud".`,
          });
        }
        data = dataFiltered;
      }
      
      const baseUrl = `${config.server.BASE_URL}`;

      // set _links for each service
      for (const service of Object.keys(data)) {
        data[service] = withSelfLink(data[service], (id) => `${baseUrl}${PATH}/${encodeURIComponent(service)}/${encodeURIComponent(id)}`);
        data[service] = {
          ...data[service],
          _links: { self: `${baseUrl}${PATH}/?service=${service}` }
        };
      }

      sendFormatted<RuntimeExtensionList>(res, data);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PHP extensions');
      sendErrorFormatted(res, {
        title: 'Unable to read PHP extensions',
        detail: {
          'message': error.message || 'An unexpected error occurred while reading PHP extensions',
        }
      });
    }
  }
});

// GET /extension/php/:service/:id - service filtered by id
extensionRouter.route({
  method: 'get',
  path: `${PATH}/:service/:id`,
  summary: 'Get Service extension by Id',
  description: `Get a specific Service extension entry by its \`id\` from the \`service\` root node.`,
  tags: [TAG],
  params: z.object({
    service: z.enum(['cloud', 'dedicated']).describe('Service name (e.g., cloud, dedicated)'),
    id: z.string().describe('Extension Id (e.g., json, imagick, gd)')
  }),
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Map all PHP versions of the choosen service allowing usage of this extension, with their status (e.g. "default", "built-in" or "available") and possible options (e.g. "wepb" for imagick)',
      schema: RuntimeExtensionVersionSchema,
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
      const { id, service } = req.params as { id: string; service: string };
      const imageId = escapeHtml(id);
      const safeService = escapeHtml(service);

      const data = await resourceManager.getResource('extension/php_extensions.json');

      const extensionEntry = data?.[service]?.[id];
      if (!extensionEntry) {
        return sendErrorFormatted(res, {
          title: 'Invalid path parameters',
          detail: {
            'status': 'invalid_value',
            'values': Object.keys(data?.[service] || data),
            'path': 'id',
            'message': `Extension id "${imageId == '{id}' ? undefined : imageId}" in Service "${safeService}" not found.`,
          },
        });
      }
      sendFormatted<RuntimeExtensionVersion>(res, extensionEntry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PHP Service extensions');
      sendErrorFormatted(res, {
        title: 'Unable to read PHP Service extensions',
        detail: {
          'message': error.message || 'An unexpected error occurred while reading PHP Service extensions',
        },
      });
    }
  }
});
