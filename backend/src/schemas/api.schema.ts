import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

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

export type ApiInfo = z.infer<typeof ApiInfoSchema>;

