import { Request, Response } from 'express';
import { z } from 'zod';
import YAML from 'yaml';
import { config } from '../config/env.config.js';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger, extractConditionalHeaders, setCacheHeaders, sendNotModified } from '../utils/index.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';

const TAG = 'OpenAPI Specification';
const PATH = '/openapi-spec';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

function resolveRequestedFormat(req: Request): 'json' | 'yaml' {
  const acceptHeader = (req.headers.accept || '').toLowerCase();
  return acceptHeader.includes('yaml') ? 'yaml' : 'json';
}

function resolveOpenApiFileName(sdks: boolean, format: 'json' | 'yaml'): string {
  if (sdks) {
    return 'openapispec-upsun-sdks.json';
  }

  return format === 'yaml' ? 'openapispec-upsun.yaml' : 'openapispec-upsun.json';
}

function parseOpenApiRawData(rawData: string, format: 'json' | 'yaml') {
  return format === 'yaml' ? YAML.parse(rawData) : JSON.parse(rawData);
}

function filterOpenApiSpecByTag(spec: any, requestedTag: string) {
  const normalizedRequestedTag = requestedTag.trim().toLowerCase();
  const availableTags = Array.isArray(spec?.tags) ? spec.tags : [];
  const matchedTag = availableTags.find((tag: any) => String(tag?.name || '').toLowerCase() === normalizedRequestedTag);

  if (!matchedTag) {
    return null;
  }

  const originalPaths = spec?.paths || {};
  const filteredPaths: Record<string, any> = {};

  for (const [pathName, pathItem] of Object.entries(originalPaths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    const filteredPathItem: Record<string, any> = {};

    for (const [methodName, operation] of Object.entries(pathItem as Record<string, any>)) {
      const lowerMethodName = methodName.toLowerCase();
      if (!HTTP_METHODS.has(lowerMethodName)) {
        filteredPathItem[methodName] = operation;
        continue;
      }

      const operationTags = Array.isArray((operation as any)?.tags) ? (operation as any).tags : [];
      const hasRequestedTag = operationTags.some((tag: string) => String(tag).toLowerCase() === normalizedRequestedTag);

      if (hasRequestedTag) {
        filteredPathItem[methodName] = operation;
      }
    }

    const hasMatchingOperation = Object.keys(filteredPathItem).some((key) => HTTP_METHODS.has(key.toLowerCase()));
    if (hasMatchingOperation) {
      filteredPaths[pathName] = filteredPathItem;
    }
  }

  if (Object.keys(filteredPaths).length === 0) {
    return null;
  }

  return {
    ...spec,
    paths: filteredPaths,
    tags: [matchedTag]
  };
}

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
      const format = resolveRequestedFormat(req);
      const sdks = req.query.sdks === 'true';

      const fileName = resolveOpenApiFileName(sdks, format);
      try {
        // serving the raw file according to the format with metadata
        const conditionalHeaders = extractConditionalHeaders(req);
        const { data, metadata, notModified } = await resourceManager.getResourceRawWithMetadata(`openapi/${fileName}`, conditionalHeaders);
        
        // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
        if (notModified) {
          return sendNotModified(res, metadata, config.cache.TTL);
        }
        
        // Set cache headers
        setCacheHeaders(res, metadata, config.cache.TTL);
        
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

// ========================================
// GET /openapi-spec/tag/:tag - Get Upsun OpenAPI spec filtered by tag
// ========================================
openapiRouter.route({
  method: 'get',
  path: `${PATH}/tag/:tag`,
  summary: 'Get Upsun OpenAPI specification filtered by tag',
  description: 'Returns a valid Upsun OpenAPI specification filtered to only endpoints linked to the selected tag.',
  tags: [TAG],
  headers: HeaderAcceptSchema,
  params: z.object({
    tag: z.string().min(1).describe('OpenAPI tag used to filter endpoints')
  }),
  query: z.object({
    sdks: z.string().optional().describe('If true, returns the SDKs specific patched version')
  }),
  responses: {
    200: {
      description: 'Filtered Upsun OpenAPI specification',
      schema: z.any()
    },
    404: {
      description: 'Tag not found or no endpoints linked to this tag',
      schema: ErrorDetailsSchema
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const format = resolveRequestedFormat(req);
      const sdks = req.query.sdks === 'true';
      const requestedTag = String(req.params.tag || '').trim();
      const fileName = resolveOpenApiFileName(sdks, format);

      const conditionalHeaders = extractConditionalHeaders(req);
      const { data, metadata, notModified } = await resourceManager.getResourceRawWithMetadata(`openapi/${fileName}`, conditionalHeaders);

      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }

      if (!data) {
        apiLogger.error({ fileName }, 'Spec file not found');
        return res.status(404).json({ error: 'Spec file not found' });
      }

      const parsedSpec = parseOpenApiRawData(data, format);
      const filteredSpec = filterOpenApiSpecByTag(parsedSpec, requestedTag);

      if (!filteredSpec) {
        return res.status(404).json({ error: `Tag '${requestedTag}' not found or no endpoints linked to this tag` });
      }

      setCacheHeaders(res, metadata, config.cache.TTL);

      if (format === 'yaml' && !sdks) {
        return res.type('text/plain; charset=utf-8').send(YAML.stringify(filteredSpec));
      }

      return res.type('application/json').send(filteredSpec);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read filtered Upsun OpenAPI spec by tag');
      return res.status(500).json({ error: error.message || 'Unable to read filtered Upsun OpenAPI spec by tag' });
    }
  }
});
