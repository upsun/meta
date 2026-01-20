import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import { sendFormatted } from '../utils/responseFormat.js';
import {
  HostRegionSchema,
  HostRegion,
  HostRegionsListSchema,
  HostRegionsList
} from '../schemas/region.schema.js';
import { HeaderAcceptSchema, ErrorDetailsSchema } from '../schemas/api.schema.js';

const TAG = 'Regions';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// REGION ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const regionRouter = new ApiRouter();

// ========================================
// GET /region - Get all regions with optional filters
// ========================================
regionRouter.route({
  method: 'get',
  path: '/region',
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
      description: 'Complete list of regions, filtered regions, or count',
      schema: HostRegionsListSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'No regions found matching the filters',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    500: {
      description: 'Internal server error',
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

      // Get regions list
      let regions = await resourceManager.getResource('host/regions.json');

      // Apply filters
      if (name) {
        const region = regions.find((r: any) => r.name === name);
        if (!region) {
          const availableRegions = regions.map((r: any) => r.name);
          apiLogger.warn({ region: name }, 'Region not found');
          return sendFormatted(res, {
            error: `Region '${name}' not found`,
            availableRegions
          }, 404);
        }

        return sendFormatted(res, region);
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
          return sendFormatted(res, {
            error: `No regions found for provider '${provider}'`,
            availableProviders
          }, 404);
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
          return sendFormatted(res, {
            error: `No regions found for zone '${zone}'`,
            availableZones
          }, 404);
        }
      }

      if (country_code) {
        regions = regions.filter(
          (r: any) => r.environmental_impact?.country_code?.toLowerCase() === country_code.toLowerCase()
        );
        if (regions.length === 0) {
          const availableCountryCodes = [...new Set(
            (await resourceManager.getResource('host/regions.json'))
              .map((r: any) => r.environmental_impact?.country_code)
              .filter(Boolean)
          )];
          return sendFormatted(res, {
            error: `No regions found for country code '${country_code}'`,
            availableCountryCodes
          }, 404);
        }
      }

      // Return count or full list
      const regionSafe = HostRegionsListSchema.parse(regions);
      sendFormatted<HostRegionsList>(res, regionSafe);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions');
      sendFormatted(res, { error: error.message || 'Unable to read regions' }, 500);
    }
  }
});

regionRouter.route({
  method: 'get',
  path: '/region/:id',
  summary: 'Get region by Id',
  description: `Returns region by Id.  `,
  tags: [TAG],
  params: z.object({
    id: z.string().describe('Region Id (e.g., us-2, eu-1, asia-3)')
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
    },
    500: {
      description: 'Internal server error',
      schema: ErrorDetailsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      // Get regions list
      let regions = await resourceManager.getResource('host/regions.json');

      // Apply filters
      if (id) {
        const region = regions.find((r: any) => r.id === id);
        if (!region) {
          const availableRegions = regions.map((r: any) => r.id);
          apiLogger.warn({ region: id }, 'Region not found');
          return sendFormatted(res, {
            error: `Region '${id}' not found`,
            availableRegions
          }, 404);
        }

        return sendFormatted<HostRegion>(res, region);
      } else {
        return sendFormatted(res, { error: 'Region ID is required' }, 400);
      }

    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions');
      sendFormatted(res, { error: error.message || 'Unable to read regions' }, 500);
    }
  }
});
