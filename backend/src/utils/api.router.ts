import { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { OpenAPIRegistry, OpenApiGeneratorV3, RouteConfig } from '@asteasolutions/zod-to-openapi';

/**
 * Route definition - Single source of truth
 */
export interface ApiRoute {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  body?: z.ZodSchema;
  responses?: {
    [statusCode: number]: {
      description: string;
      schema: z.ZodSchema;
    };
  };
  handler: RequestHandler;
}

/**
 * API Router - Registers routes and generates OpenAPI spec from same source
 */
export class ApiRouter {
  private routes: ApiRoute[] = [];
  private registry: OpenAPIRegistry;

  constructor() {
    this.registry = new OpenAPIRegistry();
  }

  /**
   * Register a route - single declaration for Express + OpenAPI + Validation
   */
  route(config: ApiRoute): this {
    this.routes.push(config);
    return this;
  }

  /**
   * Register all routes to Express app with automatic validation
   */
  registerToExpress(app: Express): void {
    this.routes.forEach(({ method, path, query, params, body, handler }) => {
      // Create validation middleware
      const validationMiddleware: RequestHandler = (req, res, next) => {
        try {
          // Validate query
          if (query) {
            const result = query.safeParse(req.query);
            if (!result.success) {
              return res.status(400).json({
                error: 'Invalid query parameters',
                details: result.error.issues
              });
            }
            // Store validated data in a custom property
            (req as any).validatedQuery = result.data;
          }

          // Validate params
          if (params) {
            const result = params.safeParse(req.params);
            if (!result.success) {
              return res.status(400).json({
                error: 'Invalid path parameters',
                details: result.error.issues
              });
            }
            (req as any).validatedParams = result.data;
          }

          // Validate body
          if (body) {
            const result = body.safeParse(req.body);
            if (!result.success) {
              return res.status(400).json({
                error: 'Invalid request body',
                details: result.error.issues
              });
            }
            (req as any).validatedBody = result.data;
          }

          next();
        } catch (error) {
          next(error);
        }
      };

      // Register route with validation + handler
      app[method](path, validationMiddleware, handler);
      console.log(`[Route] ${method.toUpperCase()} ${path}`);
    });
  }

  /**
   * Generate OpenAPI specification from registered routes
   */
  generateOpenApiSpec(config: {
    title: string;
    version: string;
    description?: string;
    servers?: Array<{ url: string; description: string }>;
    contact?: { name: string; url: string };
    license?: { name: string; url: string };
  }) {
    // Register each route in OpenAPI registry
    this.routes.forEach(({ method, path, summary, description, tags, query, params, body, responses }) => {
      const routeConfig: RouteConfig = {
        method,
        path: path.replace(/:(\w+)/g, '{$1}'), // Convert :param to {param}
        tags: tags || ['API'],
        summary: summary || '',
        description: description || '',
        request: {},
        responses: {}
      };

      // Add query schema
      if (query) {
        (routeConfig.request as any).query = query;
      }

      // Add params schema
      if (params) {
        (routeConfig.request as any).params = params;
      }

      // Add body schema
      if (body) {
        routeConfig.request!.body = {
          content: {
            'application/json': {
              schema: body
            }
          }
        };
      }

      // Add response schemas
      if (responses) {
        Object.entries(responses).forEach(([statusCode, { description: desc, schema }]) => {
          routeConfig.responses[statusCode] = {
            description: desc,
            content: {
              'application/json': {
                schema
              }
            }
          };
        });
      }

      this.registry.registerPath(routeConfig);
    });

    // Generate OpenAPI document
    const generator = new OpenApiGeneratorV3(this.registry.definitions);
    
    return generator.generateDocument({
      openapi: '3.0.0',
      info: {
        title: config.title,
        version: config.version,
        description: config.description || '',
        contact: config.contact,
        license: config.license
      },
      servers: config.servers || []
    });
  }
}
