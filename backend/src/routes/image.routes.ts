import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import {
  ImageSchema,
  ImageRegistrySchema,
  ErrorSchema
} from '../schemas/image.schema.js';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// IMAGE ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const imageRouter = new ApiRouter();

// ========================================
// GET /image - Get all images
// ========================================
imageRouter.route({
  method: 'get',
  path: '/image',
  summary: 'Get all images',
  description: 'Returns the complete list of available images with all their information (name, endpoint, versions, etc.)',
  tags: ['Images'],
  responses: {
    200: {
      description: 'Complete image registry',
      schema: ImageRegistrySchema
    },
    500: {
      description: 'Internal server error',
      schema: ErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const registry = await resourceManager.getResource('image/registry.json');
      res.json(registry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry');
      res.status(500).json({ error: error.message || 'Unable to read registry' });
    }
  }
});

// ========================================
// GET /image/:name - Get image by name
// ========================================
imageRouter.route({
  method: 'get',
  path: '/image/:name',
  summary: 'Get image by name',
  description: `
Returns information for a specific image.

**Without query parameter**: Returns all image information
**With \`items\` parameter**: Filters returned properties

### Usage Examples

\`\`\`bash
# All information
GET /image/nodejs

# Only versions
GET /image/nodejs?items=versions

# Multiple properties
GET /image/php?items=versions,endpoint
\`\`\`
  `,
  tags: ['Images'],
  params: z.object({
    name: z.string().describe('Image name (e.g., nodejs, php, chrome-headless)')
  }),
  query: z.object({
    items: z.string()
      .optional()
      .describe('Comma-separated list of properties to return (e.g., "versions,endpoint")')
  }),
  responses: {
    200: {
      description: 'Image found and returned',
      schema: ImageSchema
    },
    400: {
      description: 'Invalid query parameter',
      schema: ErrorSchema
    },
    404: {
      description: 'Image not found',
      schema: ErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { items } = req.query as { items?: string };

      // Get registry
      const registry = await resourceManager.getResource('image/registry.json');

      // Check if image exists
      if (!registry[name]) {
        const availableImages = Object.keys(registry);
        apiLogger.warn({ image: name }, 'Image not found');

        return res.status(404).json({
          error: `Image '${name}' not found`,
          availableImages
        });
      }

      let imageData = registry[name];

      // Filter properties if items parameter is provided
      if (items) {
        const requestedFields = items.split(',').map(f => f.trim());
        const filteredData: any = {};

        requestedFields.forEach(field => {
          if (field in imageData) {
            filteredData[field] = imageData[field];
          }
        });

        // Check if at least one valid field was found
        if (Object.keys(filteredData).length === 0) {
          return res.status(404).json({
            error: `No valid properties found in '${items}'`,
            availableProperties: Object.keys(imageData)
          });
        }

        imageData = filteredData;
      }

      res.json(imageData);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry file');
      res.status(500).json({ error: error.message || 'Unable to read registry file' });
    }
  }
});

// ========================================
// GET /image/:name/:version - Get image by name and version
// ========================================
imageRouter.route({
  method: 'get',
  path: '/image/:name/:version',
  summary: 'Get image by name and version',
  description: `
Returns information for a specific image version.

**Without query parameter**: Returns all image version information
**With \`items\` parameter**: Filters returned properties

### Usage Examples

\`\`\`bash
# All information
GET /image/nodejs/24

# Only versions
GET /image/nodejs/latest?items=name,is_maintained

# Multiple properties
GET /image/php/8.5?items=name,manifest
\`\`\`
  `,
  tags: ['Images'],
  params: z.object({
    name: z.string().describe('Image name (e.g., nodejs, php, chrome-headless)'),
    version: z.string().describe('Image version (e.g., 24, 8.5, latest)')
  }),
  query: z.object({
    items: z.string()
      .optional()
      .describe('Comma-separated list of properties to return (e.g., "name,manifest,eol_date")')
  }),
  responses: {
    200: {
      description: 'Image version found and returned',
      schema: ImageSchema
    },
    400: {
      description: 'Invalid query parameter',
      schema: ErrorSchema
    },
    404: {
      description: 'Image version not found',
      schema: ErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { name, version } = req.params;
      const { items } = req.query as { items?: string };

      // Get registry
      const registry = await resourceManager.getResource('image/registry.json');

      // Check if image exists
      if (!registry[name]) {
        const availableImages = Object.keys(registry);
        apiLogger.warn({ image: name }, 'Image not found');

        return res.status(404).json({
          error: `Image '${name}' not found`,
          availableImages
        });
      }

      const image = registry[name];

      // Resolve version:
      // - if "latest": take the semver-highest version in the list
      // - otherwise: find by its "name" field inside image.versions
      const versions = Array.isArray(image.versions) ? image.versions : [];

      const compareSemver = (a: string, b: string): number => {
        const as = a.split('.').map(n => parseInt(n, 10));
        const bs = b.split('.').map(n => parseInt(n, 10));
        const len = Math.max(as.length, bs.length);
        for (let i = 0; i < len; i++) {
          const av = as[i] ?? 0;
          const bv = bs[i] ?? 0;
          if (av > bv) return 1;
          if (av < bv) return -1;
        }
        return 0;
      };

      let versionData: any;
      if (versions.length > 0) {
        if (version === 'latest') {
          versionData = versions.reduce((max: any, current: any) => {
            if (!max) return current;
            return compareSemver(current.name, max.name) > 0 ? current : max;
          }, null);
        } else {
          versionData = versions.find((v: any) => v.name === version);
        }
      }

      if (!versionData) {
        const availableVersions = Array.isArray(image.versions)
          ? image.versions.map((v: any) => v.name)
          : [];

        apiLogger.warn({ image: name, version }, 'Image version not found');

        return res.status(404).json({
          error: `Version '${version}' for image '${name}' not found`,
          availableVersions
        });
      }

      let imageData = versionData;

      // Filter properties if items parameter is provided
      if (items) {
        const requestedFields = items.split(',').map(f => f.trim());
        const filteredData: any = {};

        requestedFields.forEach(field => {
          if (field in imageData) {
            filteredData[field] = imageData[field];
          }
        });

        // Check if at least one valid field was found
        if (Object.keys(filteredData).length === 0) {
          return res.status(404).json({
            error: `No valid properties found in '${items}'`,
            availableProperties: Object.keys(imageData)
          });
        }

        imageData = filteredData;
      }

      // Always include the image name in the version DTO
      imageData = {
        image: name,
        ...imageData
      };

      res.json(imageData);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry file');
      res.status(500).json({ error: error.message || 'Unable to read registry file' });
    }
  }
});
