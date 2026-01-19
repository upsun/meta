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
  description: z.string().optional().openapi({
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
      name: "JavaScript/Node.js",
      endpoint: 'https://api.upsun.com/v1/images/nodejs',
      type: 'runtime',
      description: "NodeJS service for Upsun Flex",
      repo_name: "nodejs",
      docs: {
        "relationship_name": "nodejs",
        "service_name": "nodejs",
        "url": "/languages/nodejs.html",
        "web": {
          "commands": {
            "start": "node index.js"
          }
        }
      },
      min_disk_size: null,
      runtime: true,
      need_disk: false,
      versions: [
        {
          "name": "24",
          "upsun": {"status": "supported", "internal_support": true},
          "upstream": {"status": "supported","release_date": "2025-05-06T00:00:00.000Z","end_of_active_support_date": "2026-10-20T00:00:00.000Z","end_of_life_date": "2028-04-30T00:00:00.000Z","is_lts": true,"is_maintained": true,"is_end_of_active_support": false,"is_end_of_life": false,"is_long_term_support": true},
          "manifest": {"endpoints": {"http": {"port": 80,"scheme": "http"}},"min_cpu_size": 0.1,"min_mem_size": 64,"is_persistent": null,"min_disk_size": null,"allow_scale_up": true,"allow_scale_down": true,"storage_mount_point": "/mnt","default_container_profile": "HIGH_CPU","supports_horizontal_scaling": true}
        },
        {
          "name": "22",
          "upsun": {"status": "deprecated","internal_support": true},
          "upstream": {"status": "deprecated","release_date": "2024-04-24T00:00:00.000Z","end_of_active_support_date": "2025-10-21T00:00:00.000Z","end_of_life_date": "2027-04-30T00:00:00.000Z","is_lts": true,"is_maintained": true,"is_end_of_active_support": true,"is_end_of_life": false,"is_long_term_support": true},
          "manifest": {"endpoints": {"http": {"port": 80,"scheme": "http"}},"min_cpu_size": 0.1,"min_mem_size": 64,"is_persistent": null,"min_disk_size": null,"allow_scale_up": true,"allow_scale_down": true,"storage_mount_point": "/mnt","default_container_profile": "HIGH_CPU","supports_horizontal_scaling": true}
        },
        // ... more versions
      ]
    },
    // ... more images
  }
});

/**
 * Schema for filtered image response
 */
export const FilteredImageSchema = z.record(z.string(), z.any()).openapi('FilteredImage', {
  description: 'Filtered properties of an image',
  example: {
      name: "JavaScript/Node.js",
      endpoint: 'https://api.upsun.com/v1/images/nodejs',
      type: 'runtime',
      description: "NodeJS service for Upsun Flex",
      repo_name: "nodejs",
      docs: {
        "relationship_name": "nodejs",
        "service_name": "nodejs",
        "url": "/languages/nodejs.html",
        "web": {
          "commands": {
            "start": "node index.js"
          }
        }
      },
      min_disk_size: null,
      runtime: true,
      need_disk: false,
      versions: [
        {
          "name": "24",
          "upsun": {"status": "supported", "internal_support": true},
          "upstream": {"status": "supported","release_date": "2025-05-06T00:00:00.000Z","end_of_active_support_date": "2026-10-20T00:00:00.000Z","end_of_life_date": "2028-04-30T00:00:00.000Z","is_lts": true,"is_maintained": true,"is_end_of_active_support": false,"is_end_of_life": false,"is_long_term_support": true},
          "manifest": {"endpoints": {"http": {"port": 80,"scheme": "http"}},"min_cpu_size": 0.1,"min_mem_size": 64,"is_persistent": null,"min_disk_size": null,"allow_scale_up": true,"allow_scale_down": true,"storage_mount_point": "/mnt","default_container_profile": "HIGH_CPU","supports_horizontal_scaling": true}
        },
        {
          "name": "22","upsun": {"status": "deprecated","internal_support": true},
          "upstream": {"status": "deprecated","release_date": "2024-04-24T00:00:00.000Z","end_of_active_support_date": "2025-10-21T00:00:00.000Z","end_of_life_date": "2027-04-30T00:00:00.000Z","is_lts": true,"is_maintained": true,"is_end_of_active_support": true,"is_end_of_life": false,"is_long_term_support": true},
          "manifest": {"endpoints": {"http": {"port": 80,"scheme": "http"}},"min_cpu_size": 0.1,"min_mem_size": 64,"is_persistent": null,"min_disk_size": null,"allow_scale_up": true,"allow_scale_down": true,"storage_mount_point": "/mnt","default_container_profile": "HIGH_CPU","supports_horizontal_scaling": true}
        },
        // ... more versions
      ]
    },
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
  })
}).openapi('Error');

/**
 * Schema for API info response
 */
export const ApiInfoSchema = z.object({
  message: z.string().openapi({
    example: 'Meta Registry Backend Server'
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

// Type exports for TypeScript
export type Image = z.infer<typeof ImageSchema>;
export type ImageRegistry = z.infer<typeof ImageRegistrySchema>;
export type FilteredImage = z.infer<typeof FilteredImageSchema>;
export type ErrorResponse = z.infer<typeof ErrorSchema>;
export type ApiInfo = z.infer<typeof ApiInfoSchema>;
