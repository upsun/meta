import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, escapeHtml, logger, extractConditionalHeaders, setCacheHeaders, sendNotModified } from '../utils/index.js';
import { ErrorDetailsSchema, HeaderAcceptSchema } from '../schemas/api.schema.js';
import {
  RuntimeExtensionListSchema,
  RuntimeExtensionList,
  CloudExtensionsSchema,
  CloudExtensions,
  RuntimeExtensionVersionSchema,
  RuntimeExtensionVersion,
  createPhpFullListExample,
  createPhpCloudListExample,
  PhpCloudExtensionExample,
  createPostgresqlExtensionsExample,
  PostgresqlExtensionExample,
  createSolrExtensionsExample,
  SolrExtensionExample,
  PhpExtensionNotFoundExample,
  PostgresqlExtensionNotFoundExample,
  SolrExtensionNotFoundExample
} from '../schemas/extension.schema.js';
import { sendFormatted, sendErrorFormatted } from '../utils/response.format.js';
import { withSelfLink } from '../utils/api.schema.js';

extendZodWithOpenApi(z);

const apiLogger = logger.child({ component: 'API' });
const resourceManager = new ResourceManager();

const PATH = '/extensions';
const TAG = 'Extensions';

const baseUrl = config.server.BASE_URL;

const genericErrorExample = {
  internalError: {
    summary: 'Internal server error',
    value: {
      title: 'Unable to read extensions',
      detail: 'An unexpected error occurred while reading extensions',
      status: 500
    }
  }
};

const phpFullListExample = createPhpFullListExample(baseUrl, PATH);
const phpCloudListExample = createPhpCloudListExample(baseUrl, PATH);
const postgresqlExtensionsExample = createPostgresqlExtensionsExample(baseUrl, PATH);
const solrExtensionsExample = createSolrExtensionsExample(baseUrl, PATH);


export const extensionRouter = new ApiRouter();

// GET /extensions/php - full JSON content
extensionRouter.route({
  method: 'get',
  path: `${PATH}/php`,
  summary: 'Get all PHP extensions',
  description: `Returns the list of PHP extensions and their available configuration by PHP versions, grouped by "dedicated" or "cloud" services.`,
  tags: [TAG],
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Full list of PHP extensions',
      schema: RuntimeExtensionListSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'Full PHP extensions payload',
            value: phpFullListExample
          }
        }
      }
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      examples: {
        'application/json': genericErrorExample
      }
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/php_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const baseUrl = `${config.server.BASE_URL}`;

      data.cloud = withSelfLink(data.cloud, (id) => `${baseUrl}${PATH}/cloud/${encodeURIComponent(id)}`);
      data.cloud = {
        ...data.cloud,
        _links: { self: `${baseUrl}${PATH}/cloud` }
      };

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      sendFormatted<RuntimeExtensionList>(res, data);
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

// GET /extensions/php/cloud - grouped for cloud
extensionRouter.route({
  method: 'get',
  path: `${PATH}/php/cloud`,
  summary: 'Get list of PHP extensions for cloud services',
  description: `Returns the list of PHP extensions for \`cloud\` service.`,
  tags: [TAG],
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'List of PHP extensions for cloud services',
      schema: CloudExtensionsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'PHP cloud extensions payload',
            value: phpCloudListExample
          }
        }
      }
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      examples: {
        'application/json': genericErrorExample
      }
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/php_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const cloudExtensions: CloudExtensions = data?.cloud || {};

      const baseUrl = `${config.server.BASE_URL}`;
      const cloudExtensionsWithLinks = withSelfLink(cloudExtensions, (id) => `${baseUrl}${PATH}/cloud/${encodeURIComponent(id)}`);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      sendFormatted<CloudExtensions>(res, cloudExtensionsWithLinks);
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

// GET /extensions/php/grid/:version - grid filtered by version
extensionRouter.route({
  method: 'get',
  path: `${PATH}/php/cloud/:id`,
  summary: 'Get PHP Cloud extension by Id',
  description: `Get a specific PHP Cloud extension entry by its Id from the \`cloud\` root node.`,
  tags: [TAG],
  params: z.object({
    id: z.string().describe('Extension Id (e.g., json, imagick, gd)')
  }),
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Map all PHP versions allowing usage of this extension, with their status (e.g. "default", "built-in" or "available") and possible options (e.g. "wepb" for imagick)',
      schema: RuntimeExtensionVersionSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'PHP extension versions payload',
            value: PhpCloudExtensionExample
          }
        }
      }
    },
    404: {
      description: 'Version not found',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': PhpExtensionNotFoundExample
      },
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': genericErrorExample
      },
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const imageId = escapeHtml(id);

      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/php_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const extensionEntry = data?.cloud?.[id];

      if (!extensionEntry) {
        return sendErrorFormatted(res, {
          title: 'Extension not found',
          detail: `Extension "${imageId}" not found. See extra.availableExtensions for a list of valid extension IDs.`,
          status: 404,
          extra: { availableExtensions: Object.keys(data?.cloud || {}) }
        });
      }
      
      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);
      
      sendFormatted<RuntimeExtensionVersion>(res, extensionEntry);
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

// GET /extensions/postgresql
extensionRouter.route({
  method: 'get',
  path: `${PATH}/postgresql`,
  summary: 'Get list of PostgreSQL extensions for cloud services',
  description: `Returns the list of PostgreSQL extensions for \`cloud\` service.`,
  tags: [TAG],
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'List of PostgreSQL extensions for cloud services',
      schema: CloudExtensionsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'PostgreSQL extensions payload',
            value: postgresqlExtensionsExample
          }
        }
      }
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      examples: {
        'application/json': genericErrorExample
      }
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/postgresql_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const cloudExtensions: CloudExtensions = data?.cloud || {};

      const baseUrl = `${config.server.BASE_URL}`;
      const cloudExtensionsWithLinks = withSelfLink(cloudExtensions, (id) => `${baseUrl}${PATH}/postgresql/${encodeURIComponent(id)}`);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      sendFormatted<CloudExtensions>(res, cloudExtensionsWithLinks);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PostgreSQL Cloud extensions');
      sendErrorFormatted(res, {
        title: 'Unable to read PostgreSQL Cloud extensions',
        detail: error.message || 'An unexpected error occurred while reading PostgreSQL Cloud extensions',
        status: 500
      });
    }
  }
});

// GET /extensions/postgresql/:id
extensionRouter.route({
  method: 'get',
  path: `${PATH}/postgresql/:id`,
  summary: 'Get PostgreSQL extension by Id',
  description: `Get a specific PostgreSQL extension entry by its Id from the \`cloud\` root node.`,
  tags: [TAG],
  params: z.object({
    id: z.string().describe('Extension Id (e.g., bloom, pg_stat_statements, postgis)')
  }),
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Map all PostgreSQL versions allowing usage of this extension',
      schema: RuntimeExtensionVersionSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'PostgreSQL extension versions payload',
            value: PostgresqlExtensionExample
          }
        }
      }
    },
    404: {
      description: 'Version not found',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': PostgresqlExtensionNotFoundExample
      },
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': genericErrorExample
      },
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const imageId = escapeHtml(id);

      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/postgresql_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const extensionEntry = data?.cloud?.[id];

      if (!extensionEntry) {
        return sendErrorFormatted(res, {
          title: 'Extension not found',
          detail: `Extension "${imageId}" not found. See extra.availableExtensions for a list of valid extension IDs.`,
          status: 404,
          extra: { availableExtensions: Object.keys(data?.cloud || {}) }
        });
      }
      
      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);
      
      sendFormatted<RuntimeExtensionVersion>(res, extensionEntry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read PostgreSQL Cloud extensions');
      sendErrorFormatted(res, {
        title: 'Unable to read PostgreSQL Cloud extensions',
        detail: error.message || 'An unexpected error occurred while reading PostgreSQL Cloud extensions',
        status: 500
      });
    }
  }
});

// GET /extensions/solr
extensionRouter.route({
  method: 'get',
  path: `${PATH}/solr`,
  summary: 'Get list of Solr extensions for cloud services',
  description: `Returns the list of Solr extensions for \`cloud\` service.`,
  tags: [TAG],
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'List of Solr extensions for cloud services',
      schema: CloudExtensionsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'Solr extensions payload',
            value: solrExtensionsExample
          }
        }
      }
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      examples: {
        'application/json': genericErrorExample
      }
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/solr_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const cloudExtensions: CloudExtensions = data?.cloud || {};

      const baseUrl = `${config.server.BASE_URL}`;
      const cloudExtensionsWithLinks = withSelfLink(cloudExtensions, (id) => `${baseUrl}${PATH}/solr/${encodeURIComponent(id)}`);

      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);

      sendFormatted<CloudExtensions>(res, cloudExtensionsWithLinks);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read Solr Cloud extensions');
      sendErrorFormatted(res, {
        title: 'Unable to read Solr Cloud extensions',
        detail: error.message || 'An unexpected error occurred while reading Solr Cloud extensions',
        status: 500
      });
    }
  }
});

// GET /extensions/solr/:id
extensionRouter.route({
  method: 'get',
  path: `${PATH}/solr/:id`,
  summary: 'Get Solr extension by Id',
  description: `Get a specific Solr extension entry by its Id from the \`cloud\` root node.`,
  tags: [TAG],
  params: z.object({
    id: z.string().describe('Extension Id (e.g., analysis-extras, jwt-auth, ltr)')
  }),
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Map all Solr versions allowing usage of this extension',
      schema: RuntimeExtensionVersionSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': {
          success: {
            summary: 'Solr extension versions payload',
            value: SolrExtensionExample
          }
        }
      }
    },
    404: {
      description: 'Version not found',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': SolrExtensionNotFoundExample
      },
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml'],
      examples: {
        'application/json': genericErrorExample
      },
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const imageId = escapeHtml(id);

      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceWithMetadata('extension/solr_extensions.json', conditionalHeaders);
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }
      
      const extensionEntry = data?.cloud?.[id];

      if (!extensionEntry) {
        return sendErrorFormatted(res, {
          title: 'Extension not found',
          detail: `Extension "${imageId}" not found. See extra.availableExtensions for a list of valid extension IDs.`,
          status: 404,
          extra: { availableExtensions: Object.keys(data?.cloud || {}) }
        });
      }
      
      // Set cache headers
      setCacheHeaders(res, metadata, config.cache.TTL);
      
      sendFormatted<RuntimeExtensionVersion>(res, extensionEntry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read Solr Cloud extensions');
      sendErrorFormatted(res, {
        title: 'Unable to read Solr Cloud extensions',
        detail: error.message || 'An unexpected error occurred while reading Solr Cloud extensions',
        status: 500
      });
    }
  }
});
