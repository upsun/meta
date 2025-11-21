import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import {
  RegionSchema,
  RegionsListSchema,
  RegionCountSchema,
  RegionErrorSchema
} from '../schemas/region.schema.js';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// REGION ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const regionRouter = new ApiRouter();

// ========================================
// GET /region - Get all regions or count
// ========================================
regionRouter.route({
  method: 'get',
  path: '/region',
  summary: 'Get all regions',
  description: `
Returns the complete list of available regions with their information.

**Without query parameter**: Returns full list of all regions
**With \`count=true\`**: Returns only the total number of regions

### Usage Examples

\`\`\`bash
# All regions
GET /region

# Only count
GET /region?count=true
\`\`\`
  `,
  tags: ['Regions'],
  query: z.object({
    count: z.string()
      .optional()
      .describe('Set to "true" to return only the count of regions')
  }),
  responses: {
    200: {
      description: 'Complete list of regions or count',
      schema: z.union([RegionsListSchema, RegionCountSchema])
    },
    500: {
      description: 'Internal server error',
      schema: RegionErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { count } = req.query as { count?: string };
      const regions = await resourceManager.getResource('host/regions_location.json');

      if (count === 'true') {
        res.json({ count: regions.length });
      } else {
        res.json(regions);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions');
      res.status(500).json({ error: error.message || 'Unable to read regions' });
    }
  }
});

// ========================================
// GET /region/:name - Get region by name
// ========================================
regionRouter.route({
  method: 'get',
  path: '/region/:name',
  summary: 'Get region by name',
  description: `
Returns information for a specific region.

**Without query parameter**: Returns all region information
**With \`items\` parameter**: Filters returned properties

### Usage Examples

\`\`\`bash
# All information
GET /region/us-2.platform.sh

# Only provider
GET /region/us-2.platform.sh?items=provider

# Multiple properties
GET /region/eu.platform.sh?items=provider,zone,timezone
\`\`\`
  `,
  tags: ['Regions'],
  params: z.object({
    name: z.string().describe('Region name (e.g., us-2.platform.sh, eu.platform.sh)')
  }),
  query: z.object({
    items: z.string()
      .optional()
      .describe('Comma-separated list of properties to return (e.g., "provider,zone")')
  }),
  responses: {
    200: {
      description: 'Region found and returned',
      schema: RegionSchema
    },
    400: {
      description: 'Invalid query parameter',
      schema: RegionErrorSchema
    },
    404: {
      description: 'Region not found',
      schema: RegionErrorSchema
    },
    500: {
      description: 'Internal server error',
      schema: RegionErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { items } = req.query as { items?: string };

      // Get regions list
      const regions = await resourceManager.getResource('host/regions_location.json');

      // Find region by name
      const region = regions.find((r: any) => r.name === name);

      // Check if region exists
      if (!region) {
        const availableRegions = regions.map((r: any) => r.name);
        apiLogger.warn({ region: name }, 'Region not found');

        return res.status(404).json({
          error: `Region '${name}' not found`,
          availableRegions
        });
      }

      let regionData = region;

      // Filter properties if items parameter is provided
      if (items) {
        const requestedFields = items.split(',').map(f => f.trim());
        const filteredData: any = {};

        requestedFields.forEach(field => {
          if (field in regionData) {
            filteredData[field] = regionData[field];
          }
        });

        // Check if at least one valid field was found
        if (Object.keys(filteredData).length === 0) {
          return res.status(404).json({
            error: `No valid properties found in '${items}'`,
            availableProperties: Object.keys(regionData)
          });
        }

        regionData = filteredData;
      }

      res.json(regionData);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions file');
      res.status(500).json({ error: error.message || 'Unable to read regions file' });
    }
  }
});

// ========================================
// GET /region/provider/:provider - Get regions by provider
// ========================================
regionRouter.route({
  method: 'get',
  path: '/region/provider/:provider',
  summary: 'Get regions by cloud provider',
  description: `
Returns all regions for a specific cloud provider.

### Usage Examples

\`\`\`bash
# All AWS regions
GET /region/provider/AWS

# All Azure regions
GET /region/provider/Azure

# All Google regions
GET /region/provider/Google
\`\`\`
  `,
  tags: ['Regions'],
  params: z.object({
    provider: z.string().describe('Cloud provider name (e.g., AWS, Azure, Google, OVH)')
  }),
  responses: {
    200: {
      description: 'Regions filtered by provider',
      schema: RegionsListSchema
    },
    404: {
      description: 'No regions found for this provider',
      schema: RegionErrorSchema
    },
    500: {
      description: 'Internal server error',
      schema: RegionErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;

      // Get regions list
      const regions = await resourceManager.getResource('host/regions_location.json');

      // Filter by provider (case-insensitive)
      const filteredRegions = regions.filter(
        (r: any) => r.provider.toLowerCase() === provider.toLowerCase()
      );

      if (filteredRegions.length === 0) {
        const availableProviders = [...new Set(regions.map((r: any) => r.provider))];
        return res.status(404).json({
          error: `No regions found for provider '${provider}'`,
          availableRegions: availableProviders
        });
      }

      res.json(filteredRegions);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions file');
      res.status(500).json({ error: error.message || 'Unable to read regions file' });
    }
  }
});

// ========================================
// GET /region/zone/:zone - Get regions by zone
// ========================================
regionRouter.route({
  method: 'get',
  path: '/region/zone/:zone',
  summary: 'Get regions by geographic zone',
  description: `
Returns all regions in a specific geographic zone.

### Usage Examples

\`\`\`bash
# All North American regions
GET /region/zone/North America

# All European regions
GET /region/zone/Europe

# All Australian regions
GET /region/zone/Australia
\`\`\`
  `,
  tags: ['Regions'],
  params: z.object({
    zone: z.string().describe('Geographic zone (e.g., "North America", "Europe", "Australia")')
  }),
  responses: {
    200: {
      description: 'Regions filtered by zone',
      schema: RegionsListSchema
    },
    404: {
      description: 'No regions found for this zone',
      schema: RegionErrorSchema
    },
    500: {
      description: 'Internal server error',
      schema: RegionErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { zone } = req.params;

      // Get regions list
      const regions = await resourceManager.getResource('host/regions_location.json');

      // Filter by zone (case-insensitive)
      const filteredRegions = regions.filter(
        (r: any) => r.zone.toLowerCase() === zone.toLowerCase()
      );

      if (filteredRegions.length === 0) {
        const availableZones = [...new Set(regions.map((r: any) => r.zone).filter((z: string) => z))];
        return res.status(404).json({
          error: `No regions found for zone '${zone}'`,
          availableRegions: availableZones
        });
      }

      res.json(filteredRegions);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read regions file');
      res.status(500).json({ error: error.message || 'Unable to read regions file' });
    }
  }
});
