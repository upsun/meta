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
export const ComposableImageVersionSchemaModel = z.object({
  upsun: DeployImageVersionSchemaModel.shape.upsun,
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
