import express, { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiReference } from '@scalar/express-api-reference';
import { logger } from './utils/index.js';
import { configureCors, configureRateLimit, httpLogger } from './middleware/index.js';
import { generateHomePage } from './views/home.template.js';
import { config } from './config/env.config.js';

// Import routes - SINGLE SOURCE OF TRUTH
import { imageRouter } from './routes/image.routes.js';
import { regionRouter } from './routes/region.routes.js';
import { extensionRouter } from './routes/extension.routes.js';
import { validationRouter } from './routes/validation.routes.js';
import { openapiRouter } from './routes/upsun.openapi.routes.js';
import { BaseSpec } from './routes/meta.openapi.routes.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create dedicated server logger
const serverLogger = logger.child({ component: 'Server' });

// Read application version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
let appVersion = '1.0.0';
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.version && typeof packageJson.version === 'string') {
    appVersion = packageJson.version;
  }
} catch {
  // Fallback: keep default appVersion
  console.log('Could not read version from package.json, using default 1.0.0');
}
console.log(`Starting Upsun Registry API - Version ${appVersion}`);
// Initialize Express app
const app: Express = express();
const PORT = config.server.PORT;

// Disable ETag to avoid 304 on dynamic content negotiation (e.g., YAML preview in docs)
app.set('etag', false);

// Middleware
app.use(httpLogger());
app.use(configureCors());
app.use(configureRateLimit());
app.use(express.json());

// ========================================
// AUTO-REGISTER ROUTES FROM SINGLE SOURCE
// No duplication - routes defined once in image.routes.ts
// ========================================
imageRouter.registerToExpress(app);
regionRouter.registerToExpress(app);
extensionRouter.registerToExpress(app);
validationRouter.registerToExpress(app);
openapiRouter.registerToExpress(app);

// ========================================
// AUTO-GENERATE OPENAPI SPEC
// Same source as Express routes!
// ========================================
const baseSpec = BaseSpec(appVersion);

const imageSpec = imageRouter.generateOpenApiSpec({
  title: 'Images',
  version: appVersion
});

const regionSpec = regionRouter.generateOpenApiSpec({
  title: 'Regions',
  version: appVersion
});

const extensionSpec = extensionRouter.generateOpenApiSpec({
  title: 'Extensions',
  version: appVersion
});

const validationSpec = validationRouter.generateOpenApiSpec({
  title: 'Validation',
  version: appVersion
});

const openapiSpec = openapiRouter.generateOpenApiSpec({
  title: 'OpenAPI Spec',
  version: appVersion
});

const openApiSpec = {
  ...baseSpec,
  paths: {
    ...imageSpec.paths,
    ...regionSpec.paths,
    ...extensionSpec.paths,
    ...validationSpec.paths,
    ...openapiSpec.paths
  },
  components: {
    schemas: {
      ...(imageSpec.components?.schemas || {}),
      ...(regionSpec.components?.schemas || {}),
      ...(extensionSpec.components?.schemas || {}),
      ...(validationSpec.components?.schemas || {}),
      ...(openapiSpec.components?.schemas || {})
    }
  }
};

// Scalar API Documentation
app.use(
  '/api-docs',
  apiReference({
    spec: {
      content: openApiSpec,
    },
    theme: 'purple',
    layout: 'modern',
    darkMode: false,
    customCss: `
      .scalar-app {
        --scalar-font: 'Inter', system-ui, sans-serif;
        --scalar-radius: 8px;
      }
    `,
  })
);

// For testing purposes
// OpenAPI Specification endpoint (JSON)
// app.get('/openapi.json', (req: Request, res: Response) => {
//   res.setHeader('Content-Type', 'application/json');
//   res.json(openApiSpec);
// });

// ========================================
// HOME PAGE - DYNAMICALLY GENERATED FROM OPENAPI SPEC
// ========================================
app.get('/', (req: Request, res: Response) => {
  // Extract endpoints from OpenAPI spec
  const endpoints = Object.entries(openApiSpec.paths || {}).flatMap(([path, methods]) => {
    return Object.entries(methods as any)
      .filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
      .map(([method, details]: [string, any]) => ({
        method: method.toUpperCase(),
        path: path,
        description: details.summary || details.description || 'No description',
        example: `curl ${config.server.BASE_URL}${path}`
      }));
  });

  // Generate and send HTML with BASE_URL
  const html = generateHomePage(endpoints, config.server.BASE_URL, appVersion);
  res.send(html);
});

// Serve static files from public directory (for other assets if needed)
app.use(express.static(path.join(__dirname, '../public')));

// Start server
app.listen(PORT, () => {
  serverLogger.info({ port: PORT }, `Server is running on http://localhost:${PORT}`);
  serverLogger.info({ path: '/api-docs' }, 'Documentation available at /api-docs');
});
