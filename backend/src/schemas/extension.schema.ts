import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { LinkSchema } from './links.schema.js';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

/**
 * Status of a PHP extension for a specific PHP version
 */
export const ExtensionStatusSchema = z.enum([
  'available',   // Extension can be enabled
  'default',     // Extension is enabled by default
  'built-in',    // Extension is built into PHP core
  'deprecated',  // Extension is deprecated
  'unavailable'  // Extension is not available for this version
]).openapi({
  description: 'Status of the extension for a specific PHP version',
  example: 'available'
});

/**
 * Configuration for a single PHP extension version
 */
export const ExtensionVersionConfigSchema = z.object({
  status: ExtensionStatusSchema.describe('Status of the extension for this PHP version'),
  options: z.array(z.string()).default([]).openapi({
    description: 'Additional options for the extension (e.g. "webp" for imagick)',
    example: ["webp"]
  })
}).openapi('ExtensionVersionConfig', {
  description: 'Configuration for a PHP extension in a specific PHP version',
  example: {
    status: 'available',
    options: ["webp"]
  }
});

/**
 * Mapping of PHP versions to extension configurations
 * This should be a single object, not an array
 */
export const RuntimeExtensionVersionSchema = z.record(
  z.string().regex(/^\d+\.\d+$|^\d+\.x$/).openapi({
    description: 'PHP version (e.g., "8.0", "8.1", "5.x")',
    example: "8.1"
  }),
  ExtensionVersionConfigSchema
).openapi('RuntimeExtensionVersion', {
  description: 'Mapping of PHP versions to their extension status and options',
  example: {
    "8.0": { status: "default", options: [] },
    "8.1": { status: "available", options: ["webp"] },
    "8.2": { status: "built-in", options: [] }
  }
});

const RuntimeExtensionSchema = z.object({
  versions: RuntimeExtensionVersionSchema
    .describe('Mapping of PHP versions to extension configurations'),
  _links: LinkSchema.optional().describe('Hypermedia links related to the extension entry')
}).openapi('RuntimeExtension', {
  description: 'Entry for a specific extension with its version configurations',
  example: {
    versions: {
      "8.0": { status: "default", options: [] },
      "8.1": { status: "available", options: ["webp"] },
      "8.2": { status: "built-in", options: [] }
    }
  }
});

/**
 * Schema for cloud extensions (with optional hypermedia links)
 */
export const CloudExtensionsSchema = z.record(
  z.string().openapi({
    description: 'Extension name (e.g., "amqp", "apcu", "imagick")',
    example: 'imagick'
  }),
  RuntimeExtensionSchema
).and(
  z.object({
    _links: z.record(z.string(), LinkSchema).optional().openapi({
      description: 'Hypermedia links related to the cloud extensions'
    })
  })
).openapi('CloudExtensions', {
  description: 'Mapping of Cloud extension IDs to their version entries, with optional links'
});

/**
 * Complete runtime extension list for both dedicated and cloud environments
 */
export const RuntimeExtensionListSchema = z.object({
  dedicated: z.record(
    z.string().openapi({
      description: 'Extension name for dedicated environment',
      example: 'amqp'
    }),
    RuntimeExtensionSchema
  ).openapi({
    description: 'Extensions available in dedicated environments'
  }),
  cloud: CloudExtensionsSchema.openapi({
    description: 'Extensions available in cloud environments'
  })
}).openapi('RuntimeExtensionList', {
  description: 'Complete list of PHP extensions for dedicated and cloud environments'
});

// Type exports
export type RuntimeExtensionList = z.infer<typeof RuntimeExtensionListSchema>;
export type CloudExtensions = z.infer<typeof CloudExtensionsSchema>;
export type RuntimeExtensionVersion = z.infer<typeof RuntimeExtensionVersionSchema>;
export type ExtensionVersionConfig = z.infer<typeof ExtensionVersionConfigSchema>;
export type ExtensionStatus = z.infer<typeof ExtensionStatusSchema>;
