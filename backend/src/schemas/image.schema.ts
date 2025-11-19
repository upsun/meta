import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Schema for a single image in the registry
 */
export const ImageSchema = z.object({
  name: z.string().openapi({
    description: 'Image name',
    example: 'nodejs'
  }),
  endpoint: z.string().url().openapi({
    description: 'Image endpoint URL',
    example: 'https://api.upsun.com/v1/images/nodejs'
  }),
  versions: z.array(z.string()).optional().openapi({
    description: 'List of available versions',
    example: ['18', '20', '22']
  }),
  type: z.string().optional().openapi({
    description: 'Image type',
    example: 'runtime'
  })
}).passthrough().openapi('Image'); // passthrough to allow additional properties

/**
 * Schema for the complete image registry
 */
export const ImageRegistrySchema = z.record(z.string(), ImageSchema).openapi('ImageRegistry', {
  description: 'Complete registry containing all available images',
  example: {
    'nodejs': {
      name: 'nodejs',
      endpoint: 'https://api.upsun.com/v1/images/nodejs',
      versions: ['18', '20', '22'],
      type: 'runtime'
    },
    'php': {
      name: 'php',
      endpoint: 'https://api.upsun.com/v1/images/php',
      versions: ['8.1', '8.2', '8.3'],
      type: 'runtime'
    }
  }
});

/**
 * Schema for filtered image response
 */
export const FilteredImageSchema = z.record(z.string(), z.any()).openapi('FilteredImage', {
  description: 'Filtered properties of an image',
  example: {
    versions: ['18', '20', '22'],
    endpoint: 'https://api.upsun.com/v1/images/nodejs'
  }
});

/**
 * Schema for error responses
 */
export const ErrorSchema = z.object({
  error: z.string().openapi({
    description: 'Error message',
    example: 'Image not found'
  }),
  availableImages: z.array(z.string()).optional().openapi({
    description: 'List of available images (for 404 image error)',
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
    getImage: z.object({
      path: z.string(),
      description: z.string(),
      examples: z.array(z.string())
    }),
    getImageFiltered: z.object({
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
export const ImageQuerySchema = z.object({
  items: z.string().optional().openapi({
    description: 'List of properties to return, separated by commas',
    example: 'versions,endpoint'
  })
});

// Type exports for TypeScript
export type Image = z.infer<typeof ImageSchema>;
export type ImageRegistry = z.infer<typeof ImageRegistrySchema>;
export type FilteredImage = z.infer<typeof FilteredImageSchema>;
export type ErrorResponse = z.infer<typeof ErrorSchema>;
export type ApiInfo = z.infer<typeof ApiInfoSchema>;
export type ImageQuery = z.infer<typeof ImageQuerySchema>;
