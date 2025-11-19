import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Schema for a single region
 */
export const RegionSchema = z.object({
  name: z.string().openapi({
    description: 'Region name',
    example: 'us-2.platform.sh'
  }),
  provider: z.string().openapi({
    description: 'Cloud provider',
    example: 'AWS'
  }),
  zone: z.string().openapi({
    description: 'Geographic zone',
    example: 'North America'
  }),
  timezone: z.string().openapi({
    description: 'Timezone identifier',
    example: 'America/New_York'
  })
}).passthrough().openapi('Region');

/**
 * Schema for the complete regions list
 */
export const RegionsListSchema = z.array(RegionSchema).openapi('RegionsList', {
  description: 'Complete list of all available regions',
  example: [
    {
      name: 'us-2.platform.sh',
      provider: 'AWS',
      zone: 'North America',
      timezone: 'America/New_York'
    },
    {
      name: 'eu.platform.sh',
      provider: 'AWS',
      zone: 'Europe',
      timezone: 'Europe/Dublin'
    }
  ]
});

/**
 * Schema for region count response
 */
export const RegionCountSchema = z.object({
  count: z.number().openapi({
    description: 'Total number of available regions',
    example: 15
  })
}).openapi('RegionCount');

/**
 * Schema for error responses
 */
export const RegionErrorSchema = z.object({
  error: z.string().openapi({
    description: 'Error message',
    example: 'Region not found'
  }),
  availableRegions: z.array(z.string()).optional().openapi({
    description: 'List of available region names',
    example: ['us-2.platform.sh', 'eu.platform.sh', 'au.platform.sh']
  }),
  availableProperties: z.array(z.string()).optional().openapi({
    description: 'List of available properties for a region',
    example: ['name', 'provider', 'zone', 'timezone']
  })
}).openapi('RegionError');
