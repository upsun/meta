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

export const HeaderAcceptSchema = z
  .object({
    Accept: z.enum(['application/json', 'application/x-yaml'])
      .optional()
      .default('application/json')
      .describe('Response format. Defaults to application/json.')
      .openapi({
        param: {
          name: 'Accept',
          in: 'header',
          description: 'Response format. Defaults to application/json.',
          example: 'application/json',
          required: false
        }
      })
  });

export const ErrorDetailsSchema = z
  .object({
    type: z.string().optional().default("about:blank"),
    title: z.string().optional(),
    status: z.number().int().optional(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    extra: z.any().optional(),
  })
  .loose().openapi('ErrorDetails', {
    description: 'Detailed error information conforming to RFC 7807'
  }); // Allow additional fields (“extensions”)


export type ApiInfo = z.infer<typeof ApiInfoSchema>;
export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;

