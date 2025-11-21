import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiReference } from '@scalar/express-api-reference';
import { logger } from './utils/index.js';
import { configureCors, configureRateLimit, httpLogger } from './middleware/index.js';

// Import routes - SINGLE SOURCE OF TRUTH
import { imageRouter } from './routes/image.routes.js';
import { regionRouter } from './routes/region.routes.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Create dedicated server logger
const serverLogger = logger.child({ component: 'Server' });

// Initialize Express app
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(httpLogger());
app.use(configureCors());
app.use(configureRateLimit());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ========================================
// AUTO-REGISTER ROUTES FROM SINGLE SOURCE
// No duplication - routes defined once in image.routes.ts
// ========================================
imageRouter.registerToExpress(app);
regionRouter.registerToExpress(app);

// ========================================
// AUTO-GENERATE OPENAPI SPEC
// Same source as Express routes!
// ========================================
const imageSpec = imageRouter.generateOpenApiSpec({
  title: 'Trust-Registry - Upsun Image & Region Registry API',
  version: '1.0.0',
  description: `
# Upsun Image & Region Registry API

REST API to access Upsun image and region information from the official registry.

## Features

- 📋 **Complete lists**: Retrieval of all available images and regions
- 🔍 **Search by name**: Access to specific image or region information
- 🌍 **Filter by provider/zone**: Find regions by cloud provider or geographic zone
- 🎯 **Flexible filtering**: Select properties to return via query parameters
- ✅ **Zod validation**: Automatic data schema validation
- 📊 **Rate limiting**: Protection against abuse
- 🌐 **CORS configured**: Cross-origin request support
- 📝 **Structured logs**: Logging with Pino for monitoring

### 📦 Supported Data Sources

- **Images**: \`/ressources/image/registry.json\` (local) or GitHub
- **Regions**: \`/ressources/host/regions_location.json\` (local) or GitHub

---

### Rate Limiting

- **General**: 100 requests per 15 minutes
- **Strict**: 10 requests per minute (if configured)
  `,
  contact: {
    name: 'API Support',
    url: 'https://github.com/upsun/upsun-docs'
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server'
    },
    {
      url: 'https://meta.upsun.com',
      description: 'Production server'
    }
  ]
});

const regionSpec = regionRouter.generateOpenApiSpec({
  title: 'Regions',
  version: '1.0.0'
});

// Merge paths from both specs
const openApiSpec = {
  ...imageSpec,
  paths: {
    ...imageSpec.paths,
    ...regionSpec.paths
  },
  components: {
    schemas: {
      ...(imageSpec.components?.schemas || {}),
      ...(regionSpec.components?.schemas || {})
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

// OpenAPI Specification endpoint (JSON)
app.get('/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
});

// Start server
app.listen(PORT, () => {
  serverLogger.info({ port: PORT }, `Server is running on http://localhost:${PORT}`);
  serverLogger.info({ path: '/api-docs' }, 'Documentation available at /api-docs');
});
