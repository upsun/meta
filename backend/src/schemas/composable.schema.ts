import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { DeployImageSchemaModel, DeployImageVersionSchemaModel } from './image.schema.js';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

// ========================================
// Composable Schema
// ========================================

/**
 * Schema for Composable Image Version
 * Simplified version that only requires upsun field
 */
const ComposablePackageVersionSchemaModel = z.object({
  versions: z.array(z.string().openapi('packageVersion').describe('Supported version of the package')),
  name: z.string().openapi('packageDisplayName').describe('Human readable package name'),
  url: z.string().openapi('packageUrl').describe('Documentation or website URL for the package'),
  isExternal: z.boolean().openapi('isExternal').describe('Whether this package points to external documentation')
});

export const ComposableImageVersionSchemaModel = z.object({
  upsun: DeployImageVersionSchemaModel.shape.upsun,
  packages_versions: z.record(
    z.string().openapi('packageName').describe('Package identifier key (e.g., php, python, nodejs)'),
    ComposablePackageVersionSchemaModel
  ).optional()
});

/**
 * Schema for Composable Image
 * Simplified version with optional fields for composable image
 */
export const ComposableImageSchemaModel = DeployImageSchemaModel
  .omit({
    premium: true,
  })
  .extend({
    versions: z.record(
      z.string().openapi('versionId').describe('Unique identifier for a version (e.g., 25.11, 25.05)'),
      ComposableImageVersionSchemaModel
    )
  });

export const ComposableImageSchemaDtoPublic = ComposableImageSchemaModel
  .omit({ docs: true, internal: true })
  .openapi('ComposableImage', { 
    "x-internal": false,
    description: 'Schema representing the composable image configuration.'
  });

export const ComposableImageSchemaDtoInternal = ComposableImageSchemaModel
  .openapi({ "x-internal": true });

// Type exports for TypeScript
export type ComposableImageDto = z.infer<typeof ComposableImageSchemaDtoInternal> | z.infer<typeof ComposableImageSchemaDtoPublic>;
