import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Basic helpers reused across the Upsun configuration schema
const StringOrNumberSchema = z.union([z.string(), z.number()]);
const StringOrBooleanSchema = z.union([z.string(), z.boolean()]);
const HeadersSchema = z.record(z.string(), z.string());
const AccessSchema = z.record(z.string(), z.string());
const VariablesSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

const MountSourceSchema = z.enum(['instance', 'service', 'storage', 'temporary', 'tmp']);
const MountDefinitionSchema = z.object({
  source: MountSourceSchema,
  source_path: z.string().optional(),
  service: z.string().optional()
}).strict();
const MountsSchema = z.record(z.string(), MountDefinitionSchema);

const ContainerProfileSchema = z.enum(['HIGH_CPU', 'BALANCED', 'HIGH_MEMORY', 'HIGHER_MEMORY']);

const RelationshipObjectSchema = z.object({
  service: z.string().optional(),
  endpoint: z.string().optional()
}).strict();
const RelationshipTargetSchema = z.union([z.string(), z.null(), RelationshipObjectSchema]);
const RelationshipsSchema = z.record(z.string(), RelationshipTargetSchema);

const FirewallOutboundRuleSchema = z.object({
  protocol: z.string().optional(),
  ips: z.array(z.string()).optional(),
  domains: z.array(z.string()).optional(),
  ports: z.array(z.number().int()).optional()
}).strict();
const FirewallSchema = z.object({
  outbound: z.array(FirewallOutboundRuleSchema).optional()
}).strict().nullable();

const DeprecatedResourcesSchema = z.object({
  base_memory: z.number().int().optional(),
  memory_ratio: z.number().int().optional()
}).strict().nullable();
const DeprecatedSizeSchema = z.string();

const StackObjectSchema = z.record(z.string(), z.unknown());
const StackSchema = z.union([
  z.string(),
  StackObjectSchema,
  z.array(z.union([z.string(), StackObjectSchema]))
]);

// Web helpers
const RequestBufferingSchema = z.object({
  enabled: z.boolean().optional(),
  max_request_size: z.string().optional()
}).strict();

const WebLocationRuleSchema = z.object({
  expires: StringOrNumberSchema.optional(),
  passthru: StringOrBooleanSchema.optional(),
  scripts: z.boolean().optional(),
  allow: z.boolean().optional(),
  headers: HeadersSchema.optional(),
  regexp: z.boolean().optional(),
  to: z.string(),
  prefix: z.boolean().nullable().optional(),
  append_suffix: z.boolean().nullable().optional(),
  code: z.number().int().optional()
}).strict();

const WebLocationSchema = z.object({
  root: z.string().optional(),
  expires: StringOrNumberSchema.optional(),
  passthru: StringOrBooleanSchema.optional(),
  scripts: z.boolean().optional(),
  index: z.array(z.string()).optional(),
  allow: z.boolean().optional(),
  headers: HeadersSchema.optional(),
  rules: z.record(z.string(), WebLocationRuleSchema).optional(),
  request_buffering: RequestBufferingSchema.optional()
}).strict();
const WebLocationsSchema = z.record(z.string(), WebLocationSchema);

const WebCommandsSchema = z.object({
  pre_start: z.string().optional(),
  start: z.string()
}).strict();

const WebUpstreamSchema = z.object({
  socket_family: z.string().optional(),
  protocol: z.string().nullable().optional()
}).strict();

const WebSchema = z.object({
  variables: VariablesSchema.optional(),
  timezone: z.string().optional(),
  mounts: MountsSchema.optional(),
  relationships: RelationshipsSchema.optional(),
  access: AccessSchema.optional(),
  size: DeprecatedSizeSchema.optional(),
  resources: DeprecatedResourcesSchema.optional(),
  locations: WebLocationsSchema.optional(),
  commands: WebCommandsSchema.optional(),
  upstream: WebUpstreamSchema.optional(),
  document_root: z.string().optional(),
  passthru: z.string().optional(),
  index_files: z.array(z.string()).optional(),
  whitelist: z.array(z.string()).optional(),
  blacklist: z.array(z.string()).optional(),
  expires: StringOrNumberSchema.optional(),
  move_to_root: z.boolean().optional()
}).strict();

// Runtime and operation helpers
const BuildSchema = z.object({
  flavor: z.string().nullable().optional()
}).strict();

const QuicklispSchema = z.record(z.string(), z.unknown());
const RuntimeSizingHintsSchema = z.object({
  request_memory: z.number().int().optional(),
  reserved_memory: z.number().int().optional()
}).strict();
const RuntimeXdebugSchema = z.object({
  idekey: z.string().optional()
}).strict();
const RuntimeSchema = z.object({
  extensions: z.array(z.string()).optional(),
  disabled_extensions: z.array(z.string()).optional(),
  request_terminate_timeout: z.number().int().optional(),
  sizing_hints: RuntimeSizingHintsSchema.optional(),
  xdebug: RuntimeXdebugSchema.optional(),
  quicklisp: QuicklispSchema.optional()
}).strict();

const PreflightSchema = z.object({
  enabled: z.boolean(),
  ignored_rules: z.array(z.string()).optional()
}).strict();

const DependenciesSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

const SourceOperationSchema = z.object({
  command: z.string()
}).strict();
const SourceSchema = z.object({
  root: z.string().nullable().optional(),
  operations: z.record(z.string(), SourceOperationSchema).optional()
}).strict();

const OperationCommandsSchema = z.object({
  start: z.string()
}).strict();
const OperationRoleSchema = z.enum(['viewer', 'contributor', 'admin']);
const OperationSchema = z.object({
  commands: OperationCommandsSchema,
  role: OperationRoleSchema.optional()
}).strict();
const OperationsSchema = z.record(z.string(), OperationSchema);

const HooksSchema = z.object({
  build: z.string().optional(),
  deploy: z.string().optional(),
  post_deploy: z.string().optional()
}).strict();

const CronCommandsSchema = z.object({
  start: z.string(),
  stop: z.string().nullable().optional()
}).strict();
const CronSchema = z.object({
  spec: z.string(),
  commands: CronCommandsSchema,
  shutdown_timeout: z.number().int().optional(),
  timeout: z.number().int().max(86400).optional(),
  cmd: z.string().optional()
}).strict();
const CronsSchema = z.record(z.string(), CronSchema);

const WorkerCommandsSchema = z.object({
  pre_start: z.string().optional(),
  start: z.string(),
  post_start: z.string().optional()
}).strict();
const WorkerSchema = z.object({
  firewall: FirewallSchema.optional(),
  variables: VariablesSchema.optional(),
  timezone: z.string().nullable().optional(),
  mounts: MountsSchema.optional(),
  relationships: RelationshipsSchema.optional(),
  access: AccessSchema.optional(),
  size: DeprecatedSizeSchema.optional(),
  resources: DeprecatedResourcesSchema.optional(),
  commands: WorkerCommandsSchema
}).strict();
const WorkersSchema = z.record(z.string(), WorkerSchema);

const AdditionalHostsSchema = z.record(z.string(), z.string());

// Routing helpers
const RouteTypeSchema = z.enum(['proxy', 'redirect', 'upstream']).nullable();
const RouteAttributesSchema = z.record(z.string(), z.string());
const RouteRedirectPathSchema = z.object({
  regexp: z.boolean().optional(),
  to: z.string(),
  prefix: z.boolean().nullable().optional(),
  append_suffix: z.boolean().nullable().optional(),
  code: z.number().int().optional(),
  expires: StringOrNumberSchema.optional()
}).strict();
const RouteRedirectsSchema = z.object({
  expires: StringOrNumberSchema.optional(),
  paths: z.record(z.string(), RouteRedirectPathSchema)
}).strict();
const RouteCacheSchema = z.object({
  enabled: z.boolean(),
  default_ttl: z.number().int().optional(),
  cookies: z.array(z.string()).optional(),
  headers: z.array(z.string()).optional()
}).strict();
const RouteSsiSchema = z.object({
  enabled: z.boolean()
}).strict();
const TlsStrictTransportSecuritySchema = z.object({
  enabled: z.boolean().nullable().optional(),
  include_subdomains: z.boolean().nullable().optional(),
  preload: z.boolean().nullable().optional()
}).strict();
const RouteTlsSchema = z.object({
  client_authentication: z.string().nullable().optional(),
  client_certificate_authorities: z.array(z.string()).optional(),
  min_version: z.enum(['TLSv1.1', 'TLSv1.0', 'TLSv1.3', 'TLSv1.2']).nullable().optional(),
  strict_transport_security: TlsStrictTransportSecuritySchema.optional()
}).strict();

const RouteRedirectSchema = z.object({
  type: RouteTypeSchema,
  to: z.string(),
  attributes: RouteAttributesSchema.optional(),
  id: z.string().nullable().optional(),
  primary: z.boolean().optional(),
  redirects: RouteRedirectsSchema.optional(),
  tls: RouteTlsSchema.optional()
}).strict();
const RouteUpstreamSchema = z.object({
  type: RouteTypeSchema,
  upstream: z.string(),
  attributes: RouteAttributesSchema.optional(),
  id: z.string().nullable().optional(),
  primary: z.boolean().optional(),
  redirects: RouteRedirectsSchema.optional(),
  tls: RouteTlsSchema.optional(),
  ssi: RouteSsiSchema.optional(),
  cache: RouteCacheSchema.optional()
}).strict();
const RouteEntrySchema = z.union([RouteRedirectSchema, RouteUpstreamSchema]);
const RoutesSchema = z.record(z.string(), RouteEntrySchema);
const RoutesPropertySchema = z.union([RoutesSchema, z.null()]).optional();

// Services helper
const ServiceSchema = z.object({
  type: z.string(),
  size: DeprecatedSizeSchema.optional(),
  access: z.record(z.string(), z.unknown()).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  relationships: RelationshipsSchema.optional(),
  firewall: FirewallSchema.optional(),
  resources: DeprecatedResourcesSchema.optional(),
  container_profile: ContainerProfileSchema.optional()
}).strict();
const ServicesPropertySchema = z.union([z.record(z.string(), ServiceSchema), z.null()]).optional();

// Application definition
const ApplicationBaseSchema = z.object({
  resources: DeprecatedResourcesSchema.optional(),
  container_profile: ContainerProfileSchema.optional(),
  access: AccessSchema.optional(),
  relationships: RelationshipsSchema.optional(),
  mounts: MountsSchema.optional(),
  timezone: z.string().nullable().optional(),
  variables: VariablesSchema.optional(),
  firewall: FirewallSchema.optional(),
  type: z.string().optional(),
  runtime: RuntimeSchema.optional(),
  preflight: PreflightSchema.optional(),
  dependencies: DependenciesSchema.optional(),
  build: BuildSchema.optional(),
  source: SourceSchema.optional(),
  web: WebSchema.optional(),
  operations: OperationsSchema.optional(),
  hooks: HooksSchema.optional(),
  crons: CronsSchema.optional(),
  workers: WorkersSchema.optional(),
  additional_hosts: AdditionalHostsSchema.optional(),
  stack: StackSchema.optional()
}).strict();
export const ApplicationSchema = ApplicationBaseSchema.superRefine((value, ctx) => {
  if (typeof value.type === 'undefined' && typeof value.stack === 'undefined') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An application must define either type or stack'
    });
  }
});
const ApplicationsPropertySchema = z.record(z.string(), ApplicationSchema);

export const ValidationSchema = z.object({
  applications: ApplicationsPropertySchema,
  routes: RoutesPropertySchema,
  services: ServicesPropertySchema
}).strict();

// Export types
export type Validation = z.infer<typeof ValidationSchema>;
export type Application = z.infer<typeof ApplicationSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type RouteEntry = z.infer<typeof RouteEntrySchema>;

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
  url: z.string().regex(/^https:\/\/docs\.upsun\.com\//),
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
