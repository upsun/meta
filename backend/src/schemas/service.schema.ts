import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Schema for a single service in the registry
 */
export const ServiceSchema = z.object({
  name: z.string().openapi({
    description: 'Service name',
    example: 'nodejs'
  }),
  endpoint: z.string().url().openapi({
    description: 'Service endpoint URL',
    example: 'https://api.upsun.com/v1/services/nodejs'
  }),
  versions: z.array(z.string()).optional().openapi({
    description: 'List of available versions',
    example: ['18', '20', '22']
  }),
  type: z.string().optional().openapi({
    description: 'Service type',
    example: 'runtime'
  })
}).passthrough().openapi('Service'); // passthrough to allow additional properties

/**
 * Schema for the complete service registry
 */
export const ServiceRegistrySchema = z.record(z.string(), ServiceSchema).openapi('ServiceRegistry', {
  description: 'Complete registry containing all available services',
  example: {
    'nodejs': {
      name: 'nodejs',
      endpoint: 'https://api.upsun.com/v1/services/nodejs',
      versions: ['18', '20', '22'],
      type: 'runtime'
    },
    'php': {
      name: 'php',
      endpoint: 'https://api.upsun.com/v1/services/php',
      versions: ['8.1', '8.2', '8.3'],
      type: 'runtime'
    }
  }
});

/**
 * Schema for filtered service response
 */
export const FilteredServiceSchema = z.record(z.string(), z.any()).openapi('FilteredService', {
  description: 'Filtered properties of a service',
  example: {
    versions: ['18', '20', '22'],
    endpoint: 'https://api.upsun.com/v1/services/nodejs'
  }
});

/**
 * Schema for error responses
 */
export const ErrorSchema = z.object({
  error: z.string().openapi({
    description: 'Error message',
    example: 'Service not found'
  }),
  availableServices: z.array(z.string()).optional().openapi({
    description: 'List of available services (for 404 service error)',
    example: ['nodejs', 'php', 'chrome-headless']
  }),
  availableItems: z.array(z.string()).optional().openapi({
    description: 'List of available properties (for 404 items error)',
    example: ['name', 'endpoint', 'versions', 'type']
  }),
  requestedItems: z.array(z.string()).optional().openapi({
    description: 'List of requested properties',
    example: ['versions', 'endpoint']
  })
}).openapi('Error');

/**
 * Schema for API info response
 */
export const ApiInfoSchema = z.object({
  message: z.string().openapi({
    example: 'Trust-API Backend Server'
  }),
  version: z.string().openapi({
    example: '1.0.0'
  }),
  resourceMode: z.enum(['local', 'github']).openapi({
    description: 'Resource retrieval mode',
    example: 'github'
  }),
  documentation: z.object({
    redoc: z.string().openapi({
      description: 'Scalar documentation URL',
      example: '/api-docs'
    }),
    openapi: z.string().openapi({
      description: 'OpenAPI JSON schema URL',
      example: '/openapi.json'
    }),
    description: z.string().openapi({
      example: 'Interactive Scalar interface with Zod validation'
    })
  }),
  endpoints: z.object({
    listAll: z.object({
      path: z.string(),
      description: z.string()
    }),
    getService: z.object({
      path: z.string(),
      description: z.string(),
      examples: z.array(z.string())
    }),
    getServiceFiltered: z.object({
      path: z.string(),
      description: z.string(),
      queryParams: z.object({
        items: z.string()
      }),
      examples: z.array(z.string())
    })
  })
}).openapi('ApiInfo');

/**
 * Schema for query parameters
 */
export const ServiceQuerySchema = z.object({
  items: z.string().optional().openapi({
    description: 'List of properties to return, separated by commas',
    example: 'versions,endpoint'
  })
});

// Type exports for TypeScript
export type Service = z.infer<typeof ServiceSchema>;
export type ServiceRegistry = z.infer<typeof ServiceRegistrySchema>;
export type FilteredService = z.infer<typeof FilteredServiceSchema>;
export type ErrorResponse = z.infer<typeof ErrorSchema>;
export type ApiInfo = z.infer<typeof ApiInfoSchema>;
export type ServiceQuery = z.infer<typeof ServiceQuerySchema>;
