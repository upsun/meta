import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { config } from '../config/env.config.js';

extendZodWithOpenApi(z);

// JSON Schema document used to validate Upsun configuration files (resources/validation/upsun.json).
export const UpsunJsonSchemaSchema = z.object({
  '$schema': z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  definitions: z.record(z.string(), z.unknown()).optional(),
  required: z.array(z.string()).optional()
}).loose().openapi('UpsunJsonSchema');
export type UpsunJsonSchema = z.infer<typeof UpsunJsonSchemaSchema>;

// ------------------ ValidationRegistry Schemas ------------------
const VersionStatusSchema = z.enum(['supported', 'deprecated', 'retired']);

const VersionEndpointSchema = z.object({
  port: z.number().int().min(0).optional(),
  scheme: z.string().optional(),
  default: z.boolean().optional(),
  privileges: z.record(z.string(), z.string()).optional(),
  default_database: z.string().optional()
}).passthrough();

const VersionManifestSchema = z.object({
  endpoints: z.union([
    z.record(z.string(), VersionEndpointSchema),
    z.null()
  ]).optional(),
  min_cpu_size: z.union([z.number(), z.null()]).optional(),
  min_mem_size: z.union([z.number(), z.null()]).optional(),
  is_persistent: z.union([z.boolean(), z.null()]).optional(),
  min_disk_size: z.union([z.number(), z.null()]).optional(),
  allow_scale_up: z.union([z.boolean(), z.null()]).optional(),
  allow_scale_down: z.union([z.boolean(), z.null()]).optional(),
  storage_mount_point: z.union([z.string(), z.null()]).optional(),
  default_container_profile: z.union([z.string(), z.null()]).optional(),
  supports_horizontal_scaling: z.union([z.boolean(), z.null()]).optional()
}).passthrough();

const UpsunVersionSchema = z.object({
  status: VersionStatusSchema,
  internal_support: z.boolean()
}).strict();

const UpstreamVersionSchema = z.object({
  status: VersionStatusSchema,
  release_date: z.union([z.string(), z.null()]).optional(),
  end_of_active_support_date: z.union([z.string(), z.null()]).optional(),
  end_of_life_date: z.union([z.string(), z.null()]).optional(),
  is_lts: z.boolean(),
  is_maintained: z.boolean(),
  is_end_of_active_support: z.boolean(),
  is_end_of_life: z.boolean(),
  is_long_term_support: z.boolean()
}).strict();

const ImageVersionSchema = z.object({
  name: z.string(),
  upsun: UpsunVersionSchema,
  upstream: UpstreamVersionSchema,
  manifest: VersionManifestSchema
}).passthrough();

const DedicatedGenSchema = z.object({
  supported: z.array(z.string()).optional(),
  deprecated: z.array(z.string()).optional()
}).strict();

const ImageDocsWebLocationSchema = z.object({
  root: z.string(),
  allow: z.boolean(),
  passthru: z.union([z.boolean(), z.string()])
}).strict();

const ImageDocsWebCommandsSchema = z.object({
  start: z.string()
}).strict();

const ImageDocsWebSchema = z.object({
  commands: ImageDocsWebCommandsSchema.optional(),
  locations: z.record(z.string(), ImageDocsWebLocationSchema).optional()
}).strict();

const ImageDocsHooksSchema = z.object({
  build: z.array(z.string()).optional()
}).strict();

const ImageDocsSchema = z.object({
  relationship_name: z.union([
    z.string().min(3).max(36),
    z.null()
  ]).optional(),
  service_name: z.union([z.string(), z.null()]).optional(),
  url: z.string().regex(
    new RegExp(`^${config.docs.BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
    { message: `Invalid string: must start with "${config.docs.BASE_URL}/"` }
  ),
  web: ImageDocsWebSchema.optional(),
  hooks: ImageDocsHooksSchema.optional()
}).strict();

const ImageRegistryEntrySchema = z.object({
  description: z.string().optional(),
  docs: ImageDocsSchema.optional(),
  min_disk_size: z.union([z.number(), z.null()]).optional(),
  name: z.string().optional(),
  repo_name: z.string().optional(),
  runtime: z.boolean().optional(),
  need_disk: z.boolean().optional(),
  premium: z.boolean().optional(),
  configuration: z.string().optional(),
  service_relationships: z.string().optional(),
  versions: z.array(ImageVersionSchema).min(1),
  'versions-dedicated-gen-2': z.unknown().optional(),
  'versions-dedicated-gen-3': DedicatedGenSchema.optional()
}).passthrough();

export const ValidationRegistrySchema = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  ImageRegistryEntrySchema
);
export type ValidationRegistry = z.infer<typeof ValidationRegistrySchema>;
