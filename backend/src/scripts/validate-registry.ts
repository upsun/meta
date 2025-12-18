import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const VersionStatusSchema = z.enum(['supported', 'deprecated', 'retired']);

const VersionEndpointSchema = z.object({
  port: z.number().optional(),
  scheme: z.string().optional(),
  default: z.boolean().optional(),
  privileges: z.record(z.string(), z.string()).optional(),
  default_database: z.string().optional()
}).passthrough();

const VersionManifestSchema = z.object({
  endpoints: z.record(z.string(), VersionEndpointSchema).nullable().optional(),
  min_cpu_size: z.number().nullable().optional(),
  min_mem_size: z.number().nullable().optional(),
  is_persistent: z.boolean().nullable().optional(),
  min_disk_size: z.number().nullable().optional(),
  allow_scale_up: z.boolean().nullable().optional(),
  allow_scale_down: z.boolean().nullable().optional(),
  storage_mount_point: z.string().nullable().optional(),
  default_container_profile: z.string().nullable().optional(),
  supports_horizontal_scaling: z.boolean().nullable().optional()
}).passthrough();

const ImageVersionSchema = z.object({
  name: z.string(),
  status: VersionStatusSchema,
  release_date: z.string().nullable().optional(),
  end_of_active_support_date: z.string().nullable().optional(),
  end_of_life_date: z.string().nullable().optional(),
  is_maintained: z.boolean(),
  is_end_of_active_support: z.boolean(),
  is_end_of_life: z.boolean(),
  is_long_time_support: z.boolean(),
  manifest: VersionManifestSchema
}).passthrough();

const DedicatedGenSchema = z.object({
  supported: z.array(z.string()).default([]),
  deprecated: z.array(z.string()).default([])
}).partial();

const ImageDocsWebLocationSchema = z.object({
  root: z.string().optional(),
  allow: z.boolean().optional(),
  passthru: z.boolean().optional()
}).passthrough();

const ImageDocsWebSchema = z.object({
  commands: z.object({
    start: z.string().optional()
  }).partial().optional(),
  locations: z.record(z.string(), ImageDocsWebLocationSchema).optional()
}).passthrough();

const ImageDocsHooksSchema = z.object({
  build: z.array(z.string()).optional()
}).partial();

const ImageDocsSchema = z.object({
  relationship_name: z.string().nullable().optional(),
  service_name: z.string().nullable().optional(),
  url: z.string().optional(),
  web: ImageDocsWebSchema.optional(),
  hooks: ImageDocsHooksSchema.optional()
}).passthrough();

const ImageRegistryEntrySchema = z.object({
  description: z.string().optional(),
  docs: ImageDocsSchema.optional(),
  min_disk_size: z.number().nullable().optional(),
  name: z.string().optional(),
  repo_name: z.string().optional(),
  runtime: z.boolean().optional(),
  need_disk: z.boolean().optional(),
  premium: z.boolean().optional(),
  configuration: z.string().optional(),
  service_relationships: z.string().optional(),
  versions: z.array(ImageVersionSchema).min(1),
  // Accepted but intentionally not validated (shape varies / subject to change).
  'versions-dedicated-gen-2': z.unknown().optional(),
  'versions-dedicated-gen-3': DedicatedGenSchema.optional()
}).passthrough();

const ImageRegistryRawSchema = z.record(z.string(), ImageRegistryEntrySchema);

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRegistryPath = path.resolve(scriptDir, '../../../resources/image/registry.json');
  const registryPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultRegistryPath;

  let raw: string;
  try {
    raw = await fs.readFile(registryPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read registry file at ${registryPath}`);
    console.error(error);
    process.exit(1);
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('registry.json is not valid JSON');
    console.error(error);
    process.exit(1);
    return;
  }

  const result = ImageRegistryRawSchema.safeParse(data);

  if (!result.success) {
    console.error('registry.json does not match the expected schema');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
    return;
  }

  console.log('registry.json is valid.');
}

main().catch((error) => {
  console.error('Unexpected error during registry validation');
  console.error(error);
  process.exit(1);
});
