import { Request, Response } from 'express';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ApiRouter } from '../utils/api.router.js';
import { ResourceManager, logger } from '../utils/index.js';
import YAML from 'yaml';

extendZodWithOpenApi(z);

const apiLogger = logger.child({ component: 'API' });
const resourceManager = new ResourceManager();

// Schema for the raw YAML structure (service => version => extensions[])
const PhpExtensionsSchema = z.record(
  z.string(),
  z.record(
    z.string(),
    z.array(z.string())
  )
).openapi('PhpExtensions', {
  description: 'Map of service => version => extensions[]',
  example: {
    shared: {
      '8.2': ['amqp', 'apcu', 'bcmath', 'bz2', 'cli', 'curl', 'fpm'],
      '8.3': ['amqp', 'apcu', 'bcmath', 'bz2', 'cli', 'curl', 'fpm']
    },
    'cloud': {
      '8.2': ['apcu', 'bcmath', 'cli', 'curl', 'gd', 'intl'],
      '8.3': ['apcu', 'bcmath', 'cli', 'curl', 'gd', 'intl']
    }
  }
});

export const extensionRouter = new ApiRouter();

// GET /extension/php - full YAML content
extensionRouter.route({
  method: 'get',
  path: '/extension/php',
  summary: 'Get all PHP extensions',
  description: `
Returns the list of PHP extensions by version.

**Supported formats:**
- \`application/json\` (default)
- \`application/x-yaml\`

Use the \`Accept\` header to specify your preferred format.

Example:

\`\`\`bash
GET /extension/php
\`\`\`

Example response :

\`\`\`json
{
  "shared": {
    "8.2": ["amqp", "apcu", "bcmath", "bz2", "cli", "curl", "fpm"],
    "8.3": ["amqp", "apcu", "bcmath", "bz2", "cli", "curl", "fpm"]
  }
}
\`\`\`

Supports content negotiation:
- Default response is **JSON**
- The response body is the raw YAML file when requesting YAML; syntax highlighting depends on the client

YAML example response :
\`\`\`yaml
shared:
  "8.2":
    - amqp
    - apcu
    - bcmath
    - bz2
\`\`\`
  `,
  tags: ['Extensions'],
  query: z.object({
    format: z.enum(['json', 'yaml'])
      .default('json')
      .describe('Response format (json or yaml). Default: json')
      .openapi({
        param: { name: 'format', in: 'query' },
        example: 'json',
        default: 'json'
      })
  }),
  headers: z.object({
    accept: z.enum(['application/json', 'application/x-yaml'])
      .optional()
      .describe('Response format')
  }),
  responses: {
    200: {
      description: 'Full content of php_extensions.yaml',
      schema: PhpExtensionsSchema,
      contentTypes: ['application/json', 'application/x-yaml']
    },
    500: {
      description: 'Internal server error',
      schema: z.object({ error: z.string() })
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const data = await resourceManager.getResource('extension/php_extensions.yaml');
      const validatedQuery = (req as any).validatedQuery as { format?: 'json' | 'yaml' } | undefined;
      const requestedFormat = validatedQuery?.format || (req.query as { format?: string }).format || 'json';
      const acceptHeader = (req.headers.accept || '').toLowerCase();
      const format = requestedFormat ?? (acceptHeader.includes('yaml') ? 'yaml' : 'json');
      const wantsYaml = format === 'yaml';

      if (wantsYaml) {
        const rawYaml = await resourceManager.getResourceRaw('extension/php_extensions.yaml');
        res
          .type('text/plain; charset=utf-8') // text/plain for better display in Scalar; content remains YAML
          .send(rawYaml);
      } else {
        res.json(data);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read php_extensions.yaml');
      res.status(500).json({ error: error.message || 'Unable to read php_extensions.yaml' });
    }
  }
});

// Helper to transform YAML content into a grid-friendly format
function toGrid(data: any) {
  const runtime = 'php';
  const services = Object.keys(data || {});
  return services.flatMap((service) => {
    const versions = data[service] || {};
    return Object.keys(versions).map((version) => ({
      runtime,
      service,
      version,
      extensions: versions[version]
    }));
  });
}

// GET /extension/php/grid - grouped for grid
extensionRouter.route({
  method: 'get',
  path: '/extension/php/grid',
  summary: 'Get extensions grouped for grid view',
  description: `
Returns the raw \`grid\` node from \`php_extensions.yaml\` (preserves nested structure).

Example:

\`\`\`bash
GET /extension/php/grid
\`\`\`

Supports content negotiation:
- Default response is **JSON**
- Use \`format=yaml\` or \`Accept: application/x-yaml\` to get YAML (shown as plain text in Scalar)

Example YAML response (truncated):

\`\`\`yaml
grid:
  "5.4":
    available: [apc, apcu, blackfire]
    default: [curl, gd, intl]
\`\`\`
  `,
  tags: ['Extensions'],
  query: z.object({
    format: z.enum(['json', 'yaml'])
      .default('json')
      .describe('Response format (json or yaml). Default: json')
      .openapi({
        param: { name: 'format', in: 'query' },
        example: 'json',
        default: 'json'
      })
  }),
  headers: z.object({
    accept: z.enum(['application/json', 'application/x-yaml'])
      .optional()
      .describe('Response format')
  }),
  responses: {
    200: {
      description: 'Raw grid node from php_extensions.yaml',
      schema: z.record(
        z.string(),
        z.record(
          z.string(),
          z.array(z.string())
        )
      ).describe('grid => version => (available|default) => extensions[]'),
      contentTypes: ['application/json', 'application/x-yaml']
    },
    500: {
      description: 'Internal server error',
      schema: z.object({ error: z.string() })
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const data = await resourceManager.getResource('extension/php_extensions.yaml');
      const validatedQuery = (req as any).validatedQuery as { format?: 'json' | 'yaml' } | undefined;
      const requestedFormat = validatedQuery?.format || (req.query as { format?: string }).format || 'json';
      const acceptHeader = (req.headers.accept || '').toLowerCase();
      const format = requestedFormat ?? (acceptHeader.includes('yaml') ? 'yaml' : 'json');
      const wantsYaml = format === 'yaml';
      const gridSource = (data && data.grid) || {};

      if (wantsYaml) {
        res
          .type('text/plain; charset=utf-8')
          .send(YAML.stringify(gridSource));
      } else {
        res.json(gridSource);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to build grid for extensions');
      res.status(500).json({ error: error.message || 'Unable to build grid' });
    }
  }
});

// GET /extension/php/grid/:version - grid filtered by version
extensionRouter.route({
  method: 'get',
  path: '/extension/php/grid/:version',
  summary: 'Get grid entries for a specific version',
  description: `
Filter grid results by version key (e.g., \`8.2\`).
Data is read from the \`grid\` root node in \`php_extensions.yaml\`.

Example:

\`\`\`bash
GET /extension/php/grid/8.2
\`\`\`

Supports content negotiation:
- Default response is **JSON**
- Use \`format=yaml\` or \`Accept: application/x-yaml\` to get YAML (shown as plain text in Scalar)

Returns 404 if the version is unknown.

Example response (truncated):

\`\`\`json
[
  {
    "runtime": "php",
    "service": "dedicated",
    "version": "8.2",
    "extensions": ["amqp", "apcu", "bcmath", "bz2", "cli", "curl", "fpm"]
  }
]
\`\`\`
  `,
  tags: ['Extensions'],
  params: z.object({ version: z.string().describe('Version key, e.g. 8.2') }),
  query: z.object({
    format: z.enum(['json', 'yaml'])
      .default('json')
      .describe('Response format (json or yaml). Default: json')
      .openapi({
        param: { name: 'format', in: 'query' },
        example: 'json',
        default: 'json'
      })
  }),
  headers: z.object({
    accept: z.enum(['application/json', 'application/x-yaml'])
      .optional()
      .describe('Response format')
  }),
  responses: {
    200: {
      description: 'Map of available/default extensions for the version',
      schema: z.record(
        z.string(),
        z.array(z.string())
      ).describe('Map of extension groups (available/default) => extensions[]'),
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'Version not found',
      schema: z.object({ error: z.string(), availableVersions: z.array(z.string()) })
    },
    500: {
      description: 'Internal server error',
      schema: z.object({ error: z.string() })
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { version } = req.params;
      const versionKey = version as string;
      const data = await resourceManager.getResource('extension/php_extensions.yaml');
      const gridSource = (data && data.grid) || {};
      const availableVersions = Object.keys(gridSource || {});

      if (!gridSource[versionKey]) {
        return res.status(404).json({
          error: `Version '${versionKey}' not found`,
          availableVersions
        });
      }

      const validatedQuery = (req as any).validatedQuery as { format?: 'json' | 'yaml' } | undefined;
      const requestedFormat = validatedQuery?.format || (req.query as { format?: string }).format || 'json';
      const acceptHeader = (req.headers.accept || '').toLowerCase();
      const format = requestedFormat ?? (acceptHeader.includes('yaml') ? 'yaml' : 'json');
      const wantsYaml = format === 'yaml';
      const grid = gridSource[versionKey];

      if (wantsYaml) {
        res
          .type('text/plain; charset=utf-8')
          .send(YAML.stringify(grid));
      } else {
        res.json(grid);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read service extensions');
      res.status(500).json({ error: error.message || 'Unable to read service extensions' });
    }
  }
});

// GET /extension/php/grid/:version/:type - specific extension group for a version
extensionRouter.route({
  method: 'get',
  path: '/extension/php/grid/:version/:type',
  summary: 'Get a specific extension group for a version',
  description: `
Filter grid results by version **and** group type (\`available\`, \`default\`, \`built-in\`, \`with-webp\`).
Data is read from the \`grid\` root node in \`php_extensions.yaml\`.

Example:

\`\`\`bash
GET /extension/php/grid/8.2/available
\`\`\`

Supports content negotiation:
- Default response is **JSON**
- Use \`format=yaml\` or \`Accept: application/x-yaml\` to get YAML (shown as plain text in Scalar)

Returns 404 if the version or type is unknown.

Example response (truncated):

\`\`\`json
["amqp", "apcu", "bcmath", "bz2"]
\`\`\`
  `,
  tags: ['Extensions'],
  params: z.object({
    version: z.string().describe('Version key, e.g. 8.2'),
    type: z.enum(['available', 'default', 'built-in', 'with-webp']).describe('Extension group')
  }),
  query: z.object({
    format: z.enum(['json', 'yaml'])
      .default('json')
      .describe('Response format (json or yaml). Default: json')
      .openapi({
        param: { name: 'format', in: 'query' },
        example: 'json',
        default: 'json'
      })
  }),
  headers: z.object({
    accept: z.enum(['application/json', 'application/x-yaml'])
      .optional()
      .describe('Response format')
  }),
  responses: {
    200: {
      description: 'List of extensions for the version and group',
      schema: z.array(z.string()).describe('extensions[]'),
      contentTypes: ['application/json', 'application/x-yaml']
    },
    404: {
      description: 'Version or type not found',
      schema: z.object({
        error: z.string(),
        availableVersions: z.array(z.string()).optional(),
        availableTypes: z.array(z.string()).optional()
      })
    },
    500: {
      description: 'Internal server error',
      schema: z.object({ error: z.string() })
    }
  },
  handler: async (req: Request, res: Response) => {
    try {
      const { version, type } = req.params as { version: string; type: 'available' | 'default' | 'built-in' | 'with-webp' };
      const data = await resourceManager.getResource('extension/php_extensions.yaml');
      const gridSource = (data && data.grid) || {};
      const availableVersions = Object.keys(gridSource || {});

      if (!gridSource[version]) {
        return res.status(404).json({
          error: `Version '${version}' not found`,
          availableVersions
        });
      }

      const availableTypes = Object.keys(gridSource[version] || {});
      if (!gridSource[version][type]) {
        return res.status(404).json({
          error: `Type '${type}' not found for version '${version}'`,
          availableTypes
        });
      }

      const validatedQuery = (req as any).validatedQuery as { format?: 'json' | 'yaml' } | undefined;
      const requestedFormat = validatedQuery?.format || (req.query as { format?: string }).format || 'json';
      const acceptHeader = (req.headers.accept || '').toLowerCase();
      const format = requestedFormat ?? (acceptHeader.includes('yaml') ? 'yaml' : 'json');
      const wantsYaml = format === 'yaml';
      const extensions = gridSource[version][type];

      if (wantsYaml) {
        res
          .type('text/plain; charset=utf-8')
          .send(YAML.stringify(extensions));
      } else {
        res.json(extensions);
      }
    } catch (error: any) {
      apiLogger.error({ error: error.message }, 'Failed to read version/type extensions');
      res.status(500).json({ error: error.message || 'Unable to read version/type extensions' });
    }
  }
});
