import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

export const ExtensionVersionSchema = z.record(
  z.string(), 
  z.object({
    status: z.string()
      .describe('Status of the extension for the version (e.g., "available", "default", "built-in")'),
    options: z.array(
      z.string()
        .optional()
        .describe('Additional options for the extension (e.g. "webp" for imagick')
    ).default([])
  })
).openapi('ExtensionVersion', {
  description: 'Mapping of PHP versions to their extension status and options',
  example: {
    "8.0": { status: "default", options: [] },
    "8.1": { status: "available", options: ["webp"] },
    "8.2": { status: "built-in", options: [] }
  }
});

const VersionExtensionEntrySchema = z.object({
  versions: z.array(ExtensionVersionSchema)
    .describe('List of available versions for the extension')
}).openapi('VersionExtensionEntry', {
  description: 'Entry for a specific extension with its available versions',
  example: {
    versions: [
      {
        "8.0": { status: "default", options: [] },
        "8.1": { status: "available", options: ["webp"] }
      }
    ]
  }
});

export const CloudExtensionsSchema =  z.record(
  z.string(), 
  VersionExtensionEntrySchema
).openapi('CloudExtensions', {  
  description: 'Mapping of Cloud extension IDs to their version entries',
  example: {
    "imagick": {
      versions: [
        {
          "8.0": { status: "default", options: [] },
          "8.1": { status: "available", options: ["webp"] }
        }
      ]
    },
    "gd": {
      versions: [
        {
          "8.0": { status: "built-in", options: [] },
          "8.1": { status: "built-in", options: [] }
        }
      ]
    }
  }
});

export const AllExtensionsSchema = z.object({
  dedicated: z.record(z.string(), VersionExtensionEntrySchema),
  cloud: CloudExtensionsSchema
}).openapi('AllExtensions');

export type AllExtensions = z.infer<typeof AllExtensionsSchema>;
export type CloudExtensions = z.infer<typeof CloudExtensionsSchema>;
export type ExtensionVersion = z.infer<typeof ExtensionVersionSchema>;
