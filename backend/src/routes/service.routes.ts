import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import { 
  ServiceSchema, 
  ServiceRegistrySchema, 
  ErrorSchema 
} from '../schemas/service.schema.js';

// Create dedicated API logger
const apiLogger = logger.child({ component: 'API' });

// Initialize Resource Manager
const resourceManager = new ResourceManager();

// ========================================
// SERVICE ROUTES - SINGLE SOURCE OF TRUTH
// ========================================
export const serviceRouter = new ApiRouter();

// ========================================
// GET /service - Get all services
// ========================================
serviceRouter.route({
  method: 'get',
  path: '/service',
  summary: 'Get all services',
  description: 'Returns the complete list of available services with all their information (name, endpoint, versions, etc.)',
  tags: ['Services'],
  responses: {
    200: {
      description: 'Complete service registry',
      schema: ServiceRegistrySchema
    },
    500: {
      description: 'Internal server error',
      schema: ErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const registry = await resourceManager.getResource('service/registry.json');
      res.json(registry);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry');
      res.status(500).json({ error: error.message || 'Unable to read registry' });
    }
  }
});

// ========================================
// GET /service/:name - Get service by name
// ========================================
serviceRouter.route({
  method: 'get',
  path: '/service/:name',
  summary: 'Get service by name',
  description: `
Returns information for a specific service.

**Without query parameter**: Returns all service information
**With \`items\` parameter**: Filters returned properties

### Usage Examples

\`\`\`bash
# All information
GET /service/nodejs

# Only versions
GET /service/nodejs?items=versions

# Multiple properties
GET /service/php?items=versions,endpoint
\`\`\`
  `,
  tags: ['Services'],
  params: z.object({
    name: z.string().describe('Service name (e.g., nodejs, php, chrome-headless)')
  }),
  query: z.object({
    items: z.string()
      .optional()
      .describe('Comma-separated list of properties to return (e.g., "versions,endpoint")')
  }),
  responses: {
    200: {
      description: 'Service found and returned',
      schema: ServiceSchema
    },
    400: {
      description: 'Invalid query parameter',
      schema: ErrorSchema
    },
    404: {
      description: 'Service not found',
      schema: ErrorSchema
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { items } = req.query as { items?: string };

      // Get registry
      const registry = await resourceManager.getResource('service/registry.json');

      // Check if service exists
      if (!registry[name]) {
        const availableServices = Object.keys(registry);
        apiLogger.warn({ service: name }, 'Service not found');
        
        return res.status(404).json({
          error: `Service '${name}' not found`,
          availableServices
        });
      }

      let serviceData = registry[name];

      // Filter properties if items parameter is provided
      if (items) {
        const requestedFields = items.split(',').map(f => f.trim());
        const filteredData: any = {};

        requestedFields.forEach(field => {
          if (field in serviceData) {
            filteredData[field] = serviceData[field];
          }
        });

        // Check if at least one valid field was found
        if (Object.keys(filteredData).length === 0) {
          return res.status(404).json({
            error: `No valid properties found in '${items}'`,
            availableProperties: Object.keys(serviceData)
          });
        }

        serviceData = filteredData;
      }

      res.json(serviceData);
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read registry file');
      res.status(500).json({ error: error.message || 'Unable to read registry file' });
    }
  }
});
