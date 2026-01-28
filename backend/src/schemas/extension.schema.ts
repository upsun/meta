import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { LinkSchema } from './links.schema.js';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

export const RuntimeExtensionVersionSchema = z.record(
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
).openapi('RuntimeExtensionVersion', {
  description: 'Mapping of PHP versions to their extension status and options',
  example: {
    "8.0": { status: "default", options: [] },
    "8.1": { status: "available", options: ["webp"] },
    "8.2": { status: "built-in", options: [] }
  }
});

const RuntimeExtensionSchema = z.object({
  versions: z.array(RuntimeExtensionVersionSchema)
    .describe('List of available versions for the extension'),
  _links: LinkSchema.optional().describe('Hypermedia links related to the extension entry')
}).openapi('RuntimeExtension', {
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

const ExtensionEntriesSchema = z.record(z.string(), RuntimeExtensionSchema);

//TODO: @flovntp: Remove this !!!
export const ServiceExtensionsSchema = z.object({
  data: ExtensionEntriesSchema,
  _links: LinkSchema.optional().openapi({
    description: 'Hypermedia links related to the service extensions'
  })
}).openapi('ServiceExtensions', {
  description: 'Wrapped service extensions payload with optional links'
});

export const RuntimeExtensionListSchema = z.object({
  dedicated: ServiceExtensionsSchema.optional(),
  cloud: ServiceExtensionsSchema.optional(),
}).openapi('RuntimeExtensionList');

export type RuntimeExtensionList = z.infer<typeof RuntimeExtensionListSchema>;
export type ServiceExtensions = z.infer<typeof ServiceExtensionsSchema>; //TODO: @flovntp: Remove this !!!s
export type RuntimeExtensionVersion = z.infer<typeof RuntimeExtensionVersionSchema>;
