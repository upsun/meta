import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, escapeHtml, logger, extractConditionalHeaders, setCacheHeaders, sendNotModified } from '../utils/index.js';
import type { ConditionalHeaders } from '../utils/index.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import {
  HostRegionSchema,
  HostRegion,
  HostRegionsListSchema,
  HostRegionsList
} from '../schemas/region.schema.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';
import { withSelfLink } from '../utils/api.schema.js';

const TAG = 'Regions';
const PATH = '/regions';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

/**
 * Strip a trailing query-hash suffix from an ETag value, if present.
 * Example: W/"abcd1234-q1a2b3c4" -> W/"abcd1234"
 */
function stripQueryHashSuffix(etag: string | undefined): string | undefined {
  if (!etag) {
    return etag;
  }
  // Remove any "-q<hex>" suffix at the very end of the string (case-insensitive)
  return etag.replace(/-q[0-9a-f]+(?="?$)/i, '');
}

/**
 * Normalize an If-None-Match style header by removing query-hash suffixes
 * from each ETag value while preserving multiple ETags and weak validators.
 */
function normalizeEtagHeader(header: string | undefined): string | undefined {
  if (!header) {
    return header;
  }
  return header
    .split(',')
    .map((part) => stripQueryHashSuffix(part.trim()))
    .filter((part) => part && part.length > 0)
    .join(', ');
}

// ========================================
// REGION ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const regionRouter = new ApiRouter();

// ========================================
// GET /regions - Get all regions with optional filters
// ========================================
regionRouter.route({
  method: 'get',
  path: `${PATH}`,
  summary: 'Get all regions',
  description: `Returns the complete list of available regions with optional filtering.`,
  tags: [TAG],
  query: z.object({
    name: z.string()
      .optional()
      .describe('Filter by region name [exact match] (e.g., "us-2.platform.sh", "eu.platform.sh")'),
    provider: z.string()
      .optional()
      .describe('Filter by cloud provider name [case-insensitive] (e.g., "AWS", "Azure", "Google", "OVH")'),
    zone: z.string()
      .optional()
      .describe('Filter by geographic zone [case-insensitive] (e.g., "North America", "Europe", "Australia")'),
    country_code: z.string()
      .optional()
      .describe('Filter by ISO country code [case-insensitive] (e.g., "US", "IE", "AU")')
  }),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Complete list of regions, filtered regions',
      schema: HostRegionsListSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'No regions found matching the filters',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { name, provider, zone, country_code } = req.query as {
        name?: string;
        provider?: string;
        zone?: string;
        country_code?: string;
      };
      const safeName = name ? escapeHtml(name) : undefined;
      const safeProvider = provider ? escapeHtml(provider) : undefined;
      const safeZone = zone ? escapeHtml(zone) : undefined;
      const safeCountryCode = country_code ? escapeHtml(country_code) : undefined;

      // Get regions list with metadata, supporting conditional requests
      const rawConditionalHeaders = extractConditionalHeaders(req);
      const conditionalHeaders: ConditionalHeaders | undefined = rawConditionalHeaders
        ? { ...rawConditionalHeaders }
        : undefined;
      if (conditionalHeaders && typeof conditionalHeaders.ifNoneMatch === 'string') {
        conditionalHeaders.ifNoneMatch = normalizeEtagHeader(conditionalHeaders.ifNoneMatch);
      }
      const { data: regionsData, metadata, notModified } = await resourceManager.getResourceWithMetadata(
        'host/regions.json',
        conditionalHeaders
      );
      let regionsRecord: Record<string, any> = regionsData;

      // Prepare query params for cache key
      const queryParams = { name, provider, zone, country_code };
      
      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        const baseMetadata: any =
          metadata && typeof metadata === 'object'
            ? { ...(metadata as any), etag: stripQueryHashSuffix((metadata as any).etag) }
            : metadata;
        return sendNotModified(res, baseMetadata, 
          config.cache.TTL,
          queryParams
        );
      }

      // Apply filters
      if (name) {
        const entry = Object.entries(regionsRecord).find(([, r]) => r.name === name);
        if (!entry) {
          const availableRegions = Object.values(regionsRecord).map((r: any) => r.name);
          apiLogger.warn({ region: safeName }, 'Region not found');
          return sendErrorFormatted(res, {
            title: `Region '${safeName}' not found`,
            detail: `Region '${safeName}' not found, see extra.availableRegions for a list of valid region names.`,
            status: 404,
            extra: { availableRegions }
          });
        }
      }

      if (provider) {
        const filtered = Object.fromEntries(
          Object.entries(regionsRecord).filter(([, r]) => r.provider?.name?.toLowerCase() === provider.toLowerCase())
        );
        if (Object.keys(filtered).length === 0) {
          const availableProviders = [...new Set(
            Object.values(regionsData)
              .map((r: any) => r.provider?.name)
              .filter(Boolean)
          )];

          return sendErrorFormatted(res, {
            title: `No regions found for provider '${safeProvider}'`,
            detail: `No regions found for provider '${safeProvider}', see extra.availableProviders for a list of valid providers.`,
            status: 404,
            extra: { availableProviders }
          });
        }
        regionsRecord = filtered;
      }

      if (zone) {
        const filtered = Object.fromEntries(
          Object.entries(regionsRecord).filter(([, r]) => r.zone && r.zone.toLowerCase() === zone.toLowerCase())
        );
        if (Object.keys(filtered).length === 0) {
          const availableZones = [...new Set(
            Object.values(regionsData)
              .map((r: any) => r.zone)
              .filter((z: string) => z)
          )];

          return sendErrorFormatted(res, {
            title: `No regions found for zone '${safeZone}'`,
            detail: `No regions found for zone '${safeZone}', see extra.availableZones for a list of valid zones.`,
            status: 404,
            extra: { availableZones }
          });
        }
        regionsRecord = filtered;
      }

      if (country_code) {
        const filtered = Object.fromEntries(
          Object.entries(regionsRecord).filter(([, r]) => r.country_code?.toLowerCase() === country_code.toLowerCase())
        );
        if (Object.keys(filtered).length === 0) {
          const availableCountryCodes = [...new Set(
            Object.values(regionsData)
              .map((r: any) => r.country_code)
              .filter(Boolean)
          )];

          return sendErrorFormatted(res, {
            title: `No regions found for country code '${safeCountryCode}'`,
            detail: `No regions found for country code '${safeCountryCode}', see extra.availableCountryCodes for a list of valid country codes.`,
            status: 404,
            extra: { availableCountryCodes }
          });
        }
        regionsRecord = filtered;
      }

      // Return record with self links
      const parsed = HostRegionsListSchema.parse(regionsRecord);
      const baseUrl = `${config.server.BASE_URL}`;
      const regionsWithLinks = withSelfLink(parsed, (id) => `${baseUrl}${PATH}/${encodeURIComponent(id)}`);

      // Set cache headers with query params for proper ETag
      setCacheHeaders(res, metadata, config.cache.TTL, queryParams);

      sendFormatted<HostRegionsList>(res, regionsWithLinks);

    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions');

      sendErrorFormatted(res, {
        title: 'An error occured',
        detail: error.message || 'Unable to read regions',
        status: 500
      });
    }
  }
});

// ========================================
// GET /regions/:id - Get region by id
// ========================================
regionRouter.route({
  method: 'get',
  path: `${PATH}/:id`,
  summary: 'Get region by Id',
  description: `Returns region by Id.  `,
  tags: [TAG],
  params: z.object({
    id: z.string().trim().describe('Region Id (e.g., us-2, eu-1, asia-3)')
  }),
  query: z.object({}),
  headers: HeaderAcceptSchema,
  responses: {
    200: {
      description: 'Region, filtered regions, or count',
      schema: HostRegionSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'No regions found matching the filters',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const safeId = escapeHtml(id);

      // Get regions list with metadata, supporting conditional requests
      const conditionalHeaders = extractConditionalHeaders(req);
      const { data: regions, metadata, notModified } = await resourceManager.getResourceWithMetadata('host/regions.json', conditionalHeaders);
      let regionsRecord: Record<string, any> = regions;

      // If upstream returned 304, respond with 304 (avoids unnecessary parsing)
      if (notModified) {
        return sendNotModified(res, metadata, config.cache.TTL);
      }

      // Apply filters
      if (id) {
        const region = regionsRecord[id] ?? Object.values(regionsRecord).find((r: any) => r.id === id);
        if (!region) {
          const availableRegions = Object.keys(regionsRecord);
          apiLogger.warn({ region: safeId }, 'Region not found');
          return sendErrorFormatted(res, {
            title: `Region '${safeId}' not found`,
            detail: `Region '${safeId}' not found. see extra.availableRegions for a list of valid region IDs.`,
            status: 404,
            extra: { availableRegions }
          });
        }

        // Set cache headers
        setCacheHeaders(res, metadata, config.cache.TTL);

        return sendFormatted<HostRegion>(res, region);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions');
      sendErrorFormatted(res, {
        title: 'An error occured',
        detail: error.message || 'Unable to read regions',
        status: 500
      });
    }
  }
});
