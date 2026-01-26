import { config } from '../config/env.config.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, escapeHtml, logger } from '../utils/index.js';
import { sendErrorFormatted, sendFormatted } from '../utils/response.format.js';
import {
  HostRegionSchema,
  HostRegion,
  HostRegionsListSchema,
  HostRegionsList
} from '../schemas/region.schema.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';
import { withSelfLinkArray } from '../utils/api.schema.js';

const TAG = 'Regions';
const PATH = '/regions';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

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

      // Get regions list
      let regions = await resourceManager.getResource('host/regions.json');

      // Apply filters
      if (name) {
        const region = regions.find((r: any) => r.name === name);
        if (!region) {
          const availableRegions = regions.map((r: any) => r.name);
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
        regions = regions.filter(
          (r: any) => r.provider?.name?.toLowerCase() === provider.toLowerCase()
        );
        if (regions.length === 0) {
          const availableProviders = [...new Set(
            (await resourceManager.getResource('host/regions.json'))
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
      }

      if (zone) {
        regions = regions.filter(
          (r: any) => r.zone && r.zone.toLowerCase() === zone.toLowerCase()
        );
        if (regions.length === 0) {
          const availableZones = [...new Set(
            (await resourceManager.getResource('host/regions.json'))
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
      }

      if (country_code) {
        regions = regions.filter(
          (r: any) => r.country_code?.toLowerCase() === country_code.toLowerCase()
        );
        if (regions.length === 0) {
          const availableCountryCodes = [...new Set(
            (await resourceManager.getResource('host/regions.json'))
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
      }

      // Return list
      const regionSafe = HostRegionsListSchema.parse(regions);
      const baseUrl = `${config.server.BASE_URL}`;
      const regionsWithLinks = withSelfLinkArray(regionSafe, (id) => `${baseUrl}${PATH}/${encodeURIComponent(id)}`);

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

      // Get regions list
      let regions = await resourceManager.getResource('host/regions.json');

      // Apply filters
      if (id) {
        const region = regions.find((r: any) => r.id === id);
        if (!region) {
          const availableRegions = regions.map((r: any) => r.id);
          apiLogger.warn({ region: safeId }, 'Region not found');
          return sendErrorFormatted(res, {
            title: `Region '${safeId}' not found`,
            detail: `Region '${safeId}' not found. see extra.availableRegions for a list of valid region IDs.`,
            status: 404,
            extra: { availableRegions }
          });
        }

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
